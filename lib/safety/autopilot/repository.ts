import type { SupabaseClient } from "@supabase/supabase-js";
import type { IncidentSeverity, SafetyIncidentRecord } from "./types";

type IncidentRow = {
  id: string;
  agent_id: string;
  organization_id: string;
  severity: IncidentSeverity;
  title: string;
  explanation: string;
  related_tool: string | null;
  run_id: string | null;
  action_taken: string;
  is_sample: boolean;
  created_at: string;
};

function mapIncidentRow(row: IncidentRow): SafetyIncidentRecord {
  return {
    id: row.id,
    agentId: row.agent_id,
    organizationId: row.organization_id,
    severity: row.severity,
    title: row.title,
    explanation: row.explanation,
    relatedTool: row.related_tool,
    runId: row.run_id,
    actionTaken: row.action_taken,
    isSample: row.is_sample,
    createdAt: row.created_at,
  };
}

export function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === "42P01" ||
    (error.message?.includes("Could not find the table") ?? false) ||
    (error.message?.includes("schema cache") ?? false)
  );
}

export async function listSafetyIncidents(
  supabase: SupabaseClient,
  params: {
    agentId: string;
    organizationId: string;
    severity?: IncidentSeverity;
    tool?: string;
    from?: string;
    to?: string;
    limit?: number;
  }
): Promise<{ incidents: SafetyIncidentRecord[]; tableAvailable: boolean }> {
  let query = supabase
    .from("safety_incidents")
    .select("*")
    .eq("agent_id", params.agentId)
    .eq("organization_id", params.organizationId)
    .order("created_at", { ascending: false })
    .limit(params.limit ?? 50);

  if (params.severity) query = query.eq("severity", params.severity);
  if (params.tool) query = query.ilike("related_tool", `%${params.tool}%`);
  if (params.from) query = query.gte("created_at", params.from);
  if (params.to) query = query.lte("created_at", params.to);

  const { data, error } = await query;

  if (isMissingTableError(error)) {
    return { incidents: [], tableAvailable: false };
  }
  if (error) {
    throw new Error(error.message);
  }

  return {
    incidents: (data as IncidentRow[]).map(mapIncidentRow),
    tableAvailable: true,
  };
}

export async function insertSafetyIncident(
  supabase: SupabaseClient,
  input: Omit<SafetyIncidentRecord, "id" | "createdAt"> & { userId?: string }
): Promise<SafetyIncidentRecord | null> {
  const { data, error } = await supabase
    .from("safety_incidents")
    .insert({
      agent_id: input.agentId,
      organization_id: input.organizationId,
      user_id: input.userId ?? null,
      severity: input.severity,
      title: input.title,
      explanation: input.explanation,
      related_tool: input.relatedTool,
      run_id: input.runId,
      action_taken: input.actionTaken,
      is_sample: input.isSample,
    })
    .select("*")
    .single();

  if (isMissingTableError(error)) return null;
  if (error || !data) {
    throw new Error(error?.message ?? "Failed to insert safety incident.");
  }

  return mapIncidentRow(data as IncidentRow);
}

export async function deleteSampleIncidents(
  supabase: SupabaseClient,
  agentId: string
): Promise<void> {
  const { error } = await supabase
    .from("safety_incidents")
    .delete()
    .eq("agent_id", agentId)
    .eq("is_sample", true);

  if (isMissingTableError(error)) return;
  if (error) throw new Error(error.message);
}
