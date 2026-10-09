import { fetchAuditTimeline } from "@/lib/audit/repository";
import { listDecisionAgents } from "@/lib/decision-agents/repository";
import { readPlatformLifecycle } from "@/lib/agents/platform/lifecycle-store";
import type { AgentSafetySettings } from "@/lib/agents/runtime-types";
import { ensureOrganization } from "@/lib/organizations/ensure-organization";
import { secureError, secureJson } from "@/lib/security/api";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return secureError("Unauthorized", 401);

  const organizationId = await ensureOrganization(
    supabase,
    user.id,
    user.email ?? "user@local"
  );

  const [agentsRes, runsRes, approvalsRes, auditEntries, decisionAgents] = await Promise.all([
    supabase
      .from("agents")
      .select("id, slug, name, status, safety_settings, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("agent_runs")
      .select("id, agent_id, status, summary, mode, created_at, finished_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("action_proposals")
      .select("id, status, created_at, agent_id")
      .eq("organization_id", organizationId)
      .in("status", ["review_required"])
      .limit(50),
    fetchAuditTimeline(supabase, { organizationId, limit: 30 })
      .then((page) => page.entries)
      .catch(() => []),
    listDecisionAgents(supabase, { userId: user.id, organizationId }).catch(() => []),
  ]);

  const agents = agentsRes.data ?? [];
  const runs = runsRes.data ?? [];
  const pendingApprovals = approvalsRes.data ?? [];

  let needsAttention = 0;
  let readyToDeploy = 0;
  let running = 0;

  for (const agent of agents) {
    const lifecycle = readPlatformLifecycle(
      (agent.safety_settings ?? {}) as AgentSafetySettings
    );
    if (lifecycle.stage === "needs_attention" || lifecycle.stage === "failed") needsAttention += 1;
    if (lifecycle.stage === "verified") readyToDeploy += 1;
    if (lifecycle.stage === "deployed" || agent.status === "active") running += 1;
  }

  const recentRuns = runs.slice(0, 15).map((run) => ({
    id: run.id,
    agentId: run.agent_id,
    status: run.status,
    summary: run.summary,
    createdAt: run.created_at,
  }));

  const safetyEvents = auditEntries.filter((entry) =>
    /block|review|safety|approval/i.test(
      `${entry.title} ${entry.description} ${entry.action} ${entry.runtimeEvent ?? ""}`
    )
  ).length;

  return secureJson({
    success: true,
    stats: {
      activeAgents: running,
      needsAttention,
      readyToDeploy,
      pendingApprovals: pendingApprovals.length,
      safetyEvents,
      successfulRuns: runs.filter((run) => run.status === "completed").length,
      failedRuns: runs.filter((run) => run.status === "failed").length,
      decisionAgents: decisionAgents.length,
    },
    recentRuns,
    decisionAgents: decisionAgents.map((agent) => ({
      id: agent.id,
      slug: agent.slug,
      name: agent.name,
      status: agent.status,
      purpose: agent.purpose,
    })),
    auditPreview: auditEntries.slice(0, 10),
  });
}
