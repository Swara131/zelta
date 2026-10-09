import { humanizeAgentLabel } from "@/lib/dashboard/founder-copy";
import type { AuditTimelineEntry } from "@/lib/audit/types";
import type { SafetyDecisionLabel, SafetyEventRow } from "./types";
import { founderReasonForEvent } from "./copy";

export function mapRuntimeDecision(event: string | null | undefined): SafetyDecisionLabel {
  if (event === "policy.allow" || event === "token.consumed" || event === "approval.approved") {
    return "ALLOW";
  }
  if (event === "policy.review") return "REQUIRE_APPROVAL";
  if (
    event === "policy.block" ||
    event === "execution.denied" ||
    event === "approval.rejected" ||
    event === "review.auto_denied"
  ) {
    return "BLOCK";
  }
  return "ALLOW";
}

function resolveAgentName(entry: AuditTimelineEntry): string {
  const meta = entry.metadata ?? {};
  if (typeof meta.builderAgentId === "string") {
    return humanizeAgentLabel(meta.builderAgentId);
  }
  if (typeof meta.agentId === "string") {
    return humanizeAgentLabel(meta.agentId);
  }
  if (entry.actor && entry.actor !== "Gateway") {
    return entry.actor;
  }
  return "Agent";
}

function resolveActionLabel(entry: AuditTimelineEntry): string {
  const meta = entry.metadata ?? {};
  const toolName = typeof meta.toolName === "string" ? meta.toolName : null;
  const actionType = typeof meta.actionType === "string" ? meta.actionType : null;
  if (toolName) return toolName.replace(/_/g, " ");
  if (actionType) return actionType.replace(/\./g, " · ");
  return entry.title || "Agent action";
}

function resolveStatus(decision: SafetyDecisionLabel, runtimeEvent: string | null): string {
  if (runtimeEvent === "token.consumed") return "Executed";
  if (decision === "REQUIRE_APPROVAL") return "Waiting";
  if (decision === "BLOCK") return "Blocked";
  return "Completed";
}

export function mapAuditEntryToSafetyEventRow(
  entry: AuditTimelineEntry,
  agentBySlug: Map<string, { id: string; slug: string }>
): SafetyEventRow {
  const meta = entry.metadata ?? {};
  const runtimeEvent =
    typeof entry.runtimeEvent === "string"
      ? entry.runtimeEvent
      : typeof meta.runtimeEvent === "string"
        ? meta.runtimeEvent
        : null;

  const decision = mapRuntimeDecision(runtimeEvent);
  const agentSlug =
    typeof meta.agentId === "string"
      ? meta.agentId
      : typeof meta.builderAgentId === "string"
        ? null
        : null;
  const agentRecord = agentSlug ? agentBySlug.get(agentSlug) : undefined;

  const why =
    typeof meta.reason === "string"
      ? meta.reason
      : typeof meta.why === "string"
        ? meta.why
        : entry.description;

  return {
    id: entry.id,
    timestamp: entry.timestamp,
    agentId: agentRecord?.id ?? null,
    agentName: resolveAgentName(entry),
    agentSlug: agentRecord?.slug ?? agentSlug,
    action: resolveActionLabel(entry),
    toolName: typeof meta.toolName === "string" ? meta.toolName : null,
    decision,
    reason: founderReasonForEvent({ decision, runtimeEvent, reason: why }),
    status: resolveStatus(decision, runtimeEvent),
    proposalId:
      entry.proposalId ?? (typeof meta.proposalId === "string" ? meta.proposalId : null),
    runtimeEvent,
  };
}
