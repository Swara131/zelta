import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActionPassportRecord, ActionPassportStatus, ActionPassportStore } from "./types";

const PASSPORT_COLUMNS =
  "id, organization_id, builder_agent_id, gateway_agent_id, agent_run_id, agent_action_id, action_proposal_id, tool_name, action_type, action_hash, parameters_snapshot, mission_goal, safety_decision, status, expires_at, used_at, revoked_at, created_at";

function mapRow(row: Record<string, unknown>): ActionPassportRecord {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    builderAgentId: String(row.builder_agent_id),
    gatewayAgentId: String(row.gateway_agent_id),
    agentRunId: row.agent_run_id ? String(row.agent_run_id) : null,
    agentActionId: row.agent_action_id ? String(row.agent_action_id) : null,
    actionProposalId: row.action_proposal_id ? String(row.action_proposal_id) : null,
    toolName: String(row.tool_name),
    actionType: String(row.action_type),
    actionHash: String(row.action_hash),
    parametersSnapshot: (row.parameters_snapshot as Record<string, unknown>) ?? {},
    missionGoal: row.mission_goal ? String(row.mission_goal) : null,
    safetyDecision: row.safety_decision as ActionPassportRecord["safetyDecision"],
    status: row.status as ActionPassportStatus,
    expiresAt: String(row.expires_at),
    usedAt: row.used_at ? String(row.used_at) : null,
    revokedAt: row.revoked_at ? String(row.revoked_at) : null,
    createdAt: String(row.created_at),
  };
}

export function createSupabaseActionPassportStore(
  supabase: SupabaseClient
): ActionPassportStore {
  return {
    async insert(record) {
      const { data, error } = await supabase
        .from("action_passports")
        .insert({
          id: record.id,
          organization_id: record.organizationId,
          builder_agent_id: record.builderAgentId,
          gateway_agent_id: record.gatewayAgentId,
          agent_run_id: record.agentRunId,
          agent_action_id: record.agentActionId,
          action_proposal_id: record.actionProposalId,
          tool_name: record.toolName,
          action_type: record.actionType,
          action_hash: record.actionHash,
          parameters_snapshot: record.parametersSnapshot,
          mission_goal: record.missionGoal,
          safety_decision: record.safetyDecision,
          status: record.status,
          expires_at: record.expiresAt,
          used_at: record.usedAt,
          revoked_at: record.revokedAt,
        })
        .select(PASSPORT_COLUMNS)
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? "Failed to create action passport.");
      }

      return mapRow(data as Record<string, unknown>);
    },

    async findById(id) {
      const { data, error } = await supabase
        .from("action_passports")
        .select(PASSPORT_COLUMNS)
        .eq("id", id)
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      return data ? mapRow(data as Record<string, unknown>) : null;
    },

    async findByProposalId(proposalId) {
      const { data, error } = await supabase
        .from("action_passports")
        .select(PASSPORT_COLUMNS)
        .eq("action_proposal_id", proposalId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      return data ? mapRow(data as Record<string, unknown>) : null;
    },

    async consumeAtomically(params) {
      const allowed = params.allowedStatuses ?? ["active"];
      const { data, error } = await supabase
        .from("action_passports")
        .update({
          status: "used",
          used_at: params.usedAt,
        })
        .eq("id", params.passportId)
        .in("status", allowed)
        .eq("action_hash", params.actionHash)
        .gt("expires_at", params.usedAt)
        .select(PASSPORT_COLUMNS)
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      return data ? mapRow(data as Record<string, unknown>) : null;
    },

    async revoke(passportId, revokedAt) {
      const { data, error } = await supabase
        .from("action_passports")
        .update({
          status: "revoked",
          revoked_at: revokedAt,
        })
        .eq("id", passportId)
        .in("status", ["active", "pending_approval"])
        .select(PASSPORT_COLUMNS)
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      return data ? mapRow(data as Record<string, unknown>) : null;
    },
  };
}
