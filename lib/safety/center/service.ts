import type { SupabaseClient } from "@supabase/supabase-js";
import { listReviewRequiredProposals } from "@/lib/gateway/proposals/repository";
import type { SafetyCenterPayload } from "./types";
import {
  buildAgentMissionRows,
  buildSafetyPolicyRows,
  fetchSafetyEvents,
  fetchSafetyOverviewStats,
  listOrganizationAgentsForSafety,
} from "./repository";

export async function loadSafetyCenter(
  supabase: SupabaseClient,
  organizationId: string
): Promise<SafetyCenterPayload> {
  const agents = await listOrganizationAgentsForSafety(supabase, organizationId);
  const pendingProposals = await listReviewRequiredProposals(supabase, organizationId);

  const { count: awaitingRuns } = await supabase
    .from("agent_runs")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("status", "awaiting_approval");

  const overview = await fetchSafetyOverviewStats(supabase, organizationId, agents);
  overview.activeSafetyIssues = pendingProposals.length + (awaitingRuns ?? 0);

  const [policies, missions, events] = [
    buildSafetyPolicyRows(agents, pendingProposals),
    buildAgentMissionRows(agents),
    await fetchSafetyEvents(supabase, organizationId, agents),
  ];

  return { overview, policies, missions, events };
}
