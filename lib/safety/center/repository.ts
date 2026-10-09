import type { SupabaseClient } from "@supabase/supabase-js";
import { ZELTA_PROTECTION_POLICIES } from "@/lib/agents/protection/rules";
import { mapUnknownAgentRow } from "@/lib/agents/runtime-mappers";
import type { BuilderAgentRecord } from "@/lib/agents/runtime-types";
import { hasExplicitMissionLock } from "@/lib/safety/mission";
import type { LoadedAgent } from "@/lib/agents/runtime/types";
import { fetchAuditTimeline } from "@/lib/audit/repository";
import { buildFounderActivityView } from "@/lib/audit/activity-copy";
import { mapRuntimeAuditRowToTimelineEntry } from "@/lib/gateway/audit/mapper";
import { mapAuditEntryToSafetyEventRow, mapRuntimeDecision } from "./event-mapper";
import type { AuditTimelineEntry } from "@/lib/audit/types";
import { listReviewRequiredProposals } from "@/lib/gateway/proposals/repository";
import { sanitizeActionParameters } from "@/lib/safety/sanitize";
import type {
  AgentMissionRow,
  SafetyDecisionLabel,
  SafetyEventDetail,
  SafetyEventRow,
  SafetyOverviewStats,
  SafetyPolicyRow,
} from "./types";
import { founderReasonForEvent } from "./copy";

function resolveAgentNameFromEntry(entry: AuditTimelineEntry): string {
  const meta = entry.metadata ?? {};
  if (typeof meta.agentId === "string") return meta.agentId;
  if (entry.actor) return entry.actor;
  return "Agent";
}

const SAFETY_RUNTIME_EVENTS = new Set([
  "policy.allow",
  "policy.review",
  "policy.block",
  "approval.approved",
  "approval.rejected",
  "token.consumed",
  "execution.denied",
  "review.auto_denied",
]);

function mapPolicyDecision(decision: string): SafetyDecisionLabel {
  if (decision === "REVIEW") return "REQUIRE_APPROVAL";
  if (decision === "BLOCK") return "BLOCK";
  return "ALLOW";
}

function buildLoadedAgentStub(record: BuilderAgentRecord): LoadedAgent {
  return {
    gatewayAgentId: record.slug,
    enabledTools: record.tools,
    systemPrompt: record.instructions ?? record.goal ?? "",
    record: {
      id: record.id,
      userId: record.userId,
      organizationId: record.organizationId,
      name: record.name,
      slug: record.slug,
      description: record.description,
      goal: record.goal,
      instructions: record.instructions,
      model: record.model,
      source: record.source,
      tools: record.tools,
      capabilities: record.capabilities,
      triggerType: record.triggerType,
      schedule: record.schedule,
      timezone: record.timezone,
      memoryEnabled: record.memoryEnabled,
      safetySettings: record.safetySettings,
      suggestedThreshold: record.suggestedThreshold,
      status: record.status,
      publishedAt: record.publishedAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    },
  };
}

export async function listOrganizationAgentsForSafety(
  supabase: SupabaseClient,
  organizationId: string
) {
  const { data, error } = await supabase
    .from("agents")
    .select("*")
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? [])
    .map((row) => mapUnknownAgentRow(row))
    .filter((agent): agent is NonNullable<typeof agent> => Boolean(agent));
}

export async function fetchSafetyOverviewStats(
  supabase: SupabaseClient,
  organizationId: string,
  agents: BuilderAgentRecord[]
): Promise<SafetyOverviewStats> {
  const protectedAgents = agents.filter(
    (agent) => agent.status === "active" || agent.status === "published" || agent.status === "testing"
  ).length;

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: events, error } = await supabase
    .from("audit_events")
    .select("metadata, event_type, created_at")
    .eq("organization_id", organizationId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    throw new Error(error.message);
  }

  let actionsAllowed = 0;
  let actionsRequireApproval = 0;
  let actionsBlocked = 0;

  for (const row of events ?? []) {
    const meta = (row.metadata as Record<string, unknown>) ?? {};
    const runtimeEvent =
      typeof meta.event === "string"
        ? meta.event
        : row.event_type?.includes("block")
          ? "policy.block"
          : row.event_type?.includes("review")
            ? "policy.review"
            : null;

    if (!runtimeEvent || !SAFETY_RUNTIME_EVENTS.has(runtimeEvent)) continue;

    const decision = mapRuntimeDecision(runtimeEvent);
    if (decision === "ALLOW") actionsAllowed += 1;
    if (decision === "REQUIRE_APPROVAL") actionsRequireApproval += 1;
    if (decision === "BLOCK") actionsBlocked += 1;
  }

  return {
    protectedAgents,
    actionsAllowed,
    actionsRequireApproval,
    actionsBlocked,
    activeSafetyIssues: 0,
  };
}

export function buildAgentMissionRows(
  agents: BuilderAgentRecord[]
): AgentMissionRow[] {
  return agents.map((agent) => {
    const mission = agent.safetySettings?.mission;
    const allowedTools =
      mission?.allowedTools?.length
        ? mission.allowedTools
        : agent.tools;

    const restrictions = mission?.restrictions ?? [];
    const stub = buildLoadedAgentStub(agent);

    let protectionStatus: AgentMissionRow["protectionStatus"] = "inactive";
    if (agent.status === "paused") protectionStatus = "paused";
    else if (agent.status === "active" || agent.status === "published" || agent.status === "testing") {
      protectionStatus = "active";
    }

    return {
      agentId: agent.id,
      agentSlug: agent.slug,
      agentName: agent.name,
      missionGoal: mission?.goal ?? agent.goal ?? null,
      allowedTools,
      restrictions,
      protectionStatus,
      hasExplicitMissionLock: hasExplicitMissionLock(stub),
    };
  });
}

export function buildSafetyPolicyRows(
  agents: BuilderAgentRecord[],
  pendingProposals: Awaited<ReturnType<typeof listReviewRequiredProposals>>
): SafetyPolicyRow[] {
  const rows: SafetyPolicyRow[] = [];

  for (const policy of ZELTA_PROTECTION_POLICIES) {
    rows.push({
      id: policy.id,
      name: policy.name,
      agentId: null,
      agentName: null,
      agentSlug: null,
      rule: policy.description,
      decision: mapPolicyDecision(policy.decision),
      status: "active",
      source: "platform",
    });
  }

  for (const agent of agents) {
    const custom = agent.safetySettings?.policies ?? [];
    for (const policy of custom) {
      rows.push({
        id: `${agent.id}-${policy.id}`,
        name: policy.name,
        agentId: agent.id,
        agentName: agent.name,
        agentSlug: agent.slug,
        rule: policy.description ?? policy.name,
        decision: mapPolicyDecision(
          policy.decision === "REQUIRE_APPROVAL" ? "REVIEW" : policy.decision
        ),
        status: "active",
        source: "agent",
      });
    }
  }

  for (const proposal of pendingProposals) {
    const agent = agents.find((item) => item.slug === proposal.agent_id);
    rows.push({
      id: `live-${proposal.id}`,
      name: `Pending: ${proposal.tool_name.replace(/_/g, " ")}`,
      agentId: agent?.id ?? null,
      agentName: agent?.name ?? proposal.agent_id,
      agentSlug: agent?.slug ?? proposal.agent_id,
      rule: proposal.plain_english_summary ?? "Waiting for your approval",
      decision: "REQUIRE_APPROVAL",
      status: "pending_review",
      source: "live",
    });
  }

  return rows;
}

export async function fetchSafetyEvents(
  supabase: SupabaseClient,
  organizationId: string,
  agents: BuilderAgentRecord[],
  limit = 40
): Promise<SafetyEventRow[]> {
  const timeline = await fetchAuditTimeline(supabase, { organizationId, limit: limit * 2 });
  const agentBySlug = new Map(
    agents.map((agent) => [agent.slug, { id: agent.id, slug: agent.slug }])
  );

  const rows: SafetyEventRow[] = [];

  for (const entry of timeline.entries) {
    const runtimeEvent =
      typeof entry.metadata?.runtimeEvent === "string"
        ? entry.metadata.runtimeEvent
        : typeof entry.runtimeEvent === "string"
          ? entry.runtimeEvent
          : null;

    if (runtimeEvent && !SAFETY_RUNTIME_EVENTS.has(runtimeEvent)) {
      continue;
    }

    if (!runtimeEvent && entry.source !== "runtime") {
      continue;
    }

    rows.push(mapAuditEntryToSafetyEventRow(entry, agentBySlug));

    if (rows.length >= limit) break;
  }

  return rows;
}

export async function fetchSafetyEventDetail(
  supabase: SupabaseClient,
  params: {
    organizationId: string;
    eventId: string;
    agents: BuilderAgentRecord[];
  }
): Promise<SafetyEventDetail | null> {
  const { data: runtimeRow, error: runtimeError } = await supabase
    .from("audit_events")
    .select(
      "id, organization_id, action_proposal_id, event_type, agent_id, metadata, created_at"
    )
    .eq("id", params.eventId)
    .eq("organization_id", params.organizationId)
    .maybeSingle();

  if (runtimeError) {
    throw new Error(runtimeError.message);
  }

  let entry: AuditTimelineEntry | null = null;

  if (runtimeRow) {
    entry =
      mapRuntimeAuditRowToTimelineEntry({
        id: String(runtimeRow.id),
        organization_id: String(runtimeRow.organization_id),
        action_proposal_id: runtimeRow.action_proposal_id,
        event_type: runtimeRow.event_type,
        actor_id: null,
        agent_id: runtimeRow.agent_id,
        metadata: (runtimeRow.metadata as Record<string, unknown>) ?? {},
        ip_address: null,
        user_agent: null,
        created_at: String(runtimeRow.created_at),
        users: null,
      }) ?? null;
  } else {
    const { data: logRow } = await supabase
      .from("audit_logs")
      .select("id, action, entity_type, entity_id, metadata, created_at, approval_status")
      .eq("id", params.eventId)
      .eq("organization_id", params.organizationId)
      .maybeSingle();

    if (!logRow) return null;

    entry = {
      id: String(logRow.id),
      action: logRow.action,
      title: "Safety event",
      description: typeof logRow.metadata?.description === "string" ? logRow.metadata.description : "",
      timestamp: String(logRow.created_at),
      actor: "You",
      actorEmail: null,
      risk: null,
      approvalStatus: logRow.approval_status,
      ipAddress: null,
      userAgent: null,
      entityType: logRow.entity_type,
      entityId: logRow.entity_id,
      metadata: (logRow.metadata as Record<string, unknown>) ?? {},
      source: "retrospective",
    };
  }

  if (!entry) return null;

  const view = buildFounderActivityView(entry) ?? {
    agentName: resolveAgentNameFromEntry(entry),
    whatHappened: entry.description || entry.title,
    whyDecision:
      typeof entry.metadata?.reason === "string"
        ? entry.metadata.reason
        : entry.description,
    zeltaChecked: {
      policy: "Evaluated",
      risk: "—",
      humanReview: "—",
    },
    agentId: "unknown",
  };
  const meta = entry.metadata ?? {};
  const runtimeEvent =
    typeof entry.runtimeEvent === "string"
      ? entry.runtimeEvent
      : typeof meta.runtimeEvent === "string"
        ? meta.runtimeEvent
        : null;
  const decision = mapRuntimeDecision(runtimeEvent);

  const builderAgentId =
    typeof meta.builderAgentId === "string" ? meta.builderAgentId : null;
  const agentRecord =
    params.agents.find((agent) => agent.id === builderAgentId) ??
    params.agents.find((agent) => agent.slug === view.agentId) ??
    params.agents.find((agent) => agent.slug === entry.metadata?.agentId);

  let proposal = null;
  const proposalId =
    entry.proposalId ??
    (typeof meta.proposalId === "string" ? meta.proposalId : entry.entityId);

  if (proposalId) {
    const { data } = await supabase
      .from("action_proposals")
      .select(
        "id, status, tool_name, action_type, action_payload, policy_decision, risk_level, plain_english_summary, decided_at, executed_at, expires_at"
      )
      .eq("id", proposalId)
      .eq("organization_id", params.organizationId)
      .maybeSingle();
    proposal = data;
  }

  type PassportRow = {
    id: string;
    status: string;
    expires_at: string;
    action_hash: string;
  };

  let passport: PassportRow | null = null;

  if (proposalId) {
    const { data } = await supabase
      .from("action_passports")
      .select("id, status, expires_at, action_hash")
      .eq("action_proposal_id", proposalId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    passport = (data as PassportRow | null) ?? null;
  }

  const rawParams =
    (proposal?.action_payload as Record<string, unknown>) ??
    (typeof meta.sanitizedParameters === "object" && meta.sanitizedParameters
      ? (meta.sanitizedParameters as Record<string, unknown>)
      : {});

  const matchedPolicies = Array.isArray(meta.matchedPolicies)
    ? (meta.matchedPolicies as Array<{ name?: string; reason?: string }>)
    : [];

  const missionReason = matchedPolicies.find((policy) =>
    policy.reason?.toLowerCase().includes("mission")
  )?.reason;

  return {
    id: entry.id,
    timestamp: entry.timestamp,
    agent: {
      id: agentRecord?.id ?? builderAgentId,
      slug: agentRecord?.slug ?? (view.agentId !== "unknown" ? view.agentId : null),
      name: agentRecord?.name ?? view.agentName,
      gatewayAgentId:
        typeof meta.agentId === "string"
          ? meta.agentId
          : agentRecord?.slug ?? null,
    },
    mission: agentRecord?.safetySettings?.mission?.goal ?? agentRecord?.goal ?? null,
    tool:
      (proposal?.tool_name as string | undefined) ??
      (typeof meta.toolName === "string" ? meta.toolName : null),
    action:
      (proposal?.action_type as string | undefined) ??
      (typeof meta.actionType === "string" ? meta.actionType : null),
    parameters: sanitizeActionParameters(rawParams),
    policyDecision: proposal?.policy_decision ?? view.zeltaChecked.policy,
    missionDecision: missionReason ?? (view.whyDecision.includes("mission") ? view.whyDecision : null),
    riskDecision:
      (proposal?.risk_level as string | undefined) ??
      (typeof meta.riskLevel === "string" ? meta.riskLevel : view.zeltaChecked.risk),
    passport: {
      id: passport?.id ?? null,
      status: passport?.status ?? null,
      expiresAt: passport?.expires_at ?? null,
      hashVerified:
        runtimeEvent === "execution.denied"
          ? false
          : runtimeEvent === "token.consumed"
            ? true
            : passport
              ? null
              : null,
    },
    approval: {
      status: proposal?.status ?? entry.approvalStatus,
      decidedAt: (proposal?.decided_at as string | undefined) ?? null,
    },
    execution: {
      status:
        runtimeEvent === "token.consumed"
          ? "executed"
          : proposal?.executed_at
            ? "executed"
            : decision === "BLOCK"
              ? "blocked"
              : decision === "REQUIRE_APPROVAL"
                ? "awaiting_approval"
                : null,
      executedAt: (proposal?.executed_at as string | undefined) ?? null,
    },
    founderSummary: view.whatHappened,
    founderReason: founderReasonForEvent({
      decision,
      runtimeEvent,
      reason: view.whyDecision,
    }),
  };
}
