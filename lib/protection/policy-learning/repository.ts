import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProposalLearningRecord } from "./analyzer";

const DEFAULT_WINDOW_DAYS = 90;

export async function listProposalLearningRecords(
  supabase: SupabaseClient,
  organizationId: string,
  windowDays = DEFAULT_WINDOW_DAYS
): Promise<ProposalLearningRecord[]> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("action_proposals")
    .select("tool_name, action_type, action_payload, status, plain_english_summary")
    .eq("organization_id", organizationId)
    .gte("created_at", since)
    .in("status", ["allowed", "approved", "rejected", "blocked"])
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => ({
    toolName: String(row.tool_name ?? ""),
    actionType: String(row.action_type ?? ""),
    actionPayload:
      typeof row.action_payload === "object" && row.action_payload !== null
        ? (row.action_payload as Record<string, unknown>)
        : {},
    status: String(row.status ?? ""),
    plainEnglishSummary:
      typeof row.plain_english_summary === "string" ? row.plain_english_summary : null,
  }));
}
