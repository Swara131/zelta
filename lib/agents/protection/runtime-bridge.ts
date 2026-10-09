import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActionProposalRow } from "@/lib/gateway/proposals/repository";
import type { RunAgentResult } from "../runtime/types";
import {
  cancelAgentRunAfterRejection,
  resumeAgentRunAfterApproval,
} from "../runtime/resume-run";

function readRuntimeRunId(payload: Record<string, unknown>): string | null {
  const value = payload._zeltaRuntimeRunId;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readBuilderAgentId(payload: Record<string, unknown>): string | null {
  const value = payload._zeltaBuilderAgentId;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function isRuntimeAgentProposal(proposal: ActionProposalRow): boolean {
  const payload = proposal.action_payload ?? {};
  return Boolean(readRuntimeRunId(payload) && readBuilderAgentId(payload));
}

export async function handleRuntimeProposalDecision(
  supabase: SupabaseClient,
  params: {
    proposal: ActionProposalRow;
    userId: string;
    userEmail: string;
    decision: "approved" | "rejected";
    note?: string;
  }
): Promise<{ resumed: boolean; runId: string | null; runResult?: RunAgentResult }> {
  const payload = params.proposal.action_payload ?? {};
  const runId = readRuntimeRunId(payload);

  if (!runId || !isRuntimeAgentProposal(params.proposal)) {
    return { resumed: false, runId: null };
  }

  if (params.decision === "approved") {
    const runResult = await resumeAgentRunAfterApproval(supabase, {
      runId,
      userId: params.userId,
      userEmail: params.userEmail,
      proposalId: params.proposal.id,
    });
    return { resumed: true, runId, runResult };
  }

  await cancelAgentRunAfterRejection(supabase, {
    runId,
    userId: params.userId,
    proposalId: params.proposal.id,
    reason: params.note,
  });

  return { resumed: false, runId };
}
