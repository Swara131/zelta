import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  executeApprovedAction,
  setApprovalGateProposalLookupForTests,
  setApprovalGateToolExecutorForTests,
} from "@/lib/safety/approval-gate/gate";
import { evaluateZeltaProtection } from "./evaluator";
import type { LoadedAgent } from "../runtime/types";

function mockAgent(tools: string[]): LoadedAgent {
  return {
    gatewayAgentId: "crm-agent",
    enabledTools: tools,
    systemPrompt: "test",
    record: {
      id: "00000000-0000-4000-8000-000000000001",
      userId: "user",
      organizationId: "org",
      name: "Customer Management Agent",
      slug: "crm-agent",
      description: "Manage customers",
      goal: "Manage customers",
      instructions: null,
      model: null,
      source: "test",
      tools,
      capabilities: [],
      triggerType: "schedule",
      schedule: {},
      timezone: "UTC",
      memoryEnabled: false,
      safetySettings: {},
      suggestedThreshold: 5000,
      status: "published",
      publishedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };
}

describe("real-time approval flow", () => {
  it("pauses CRM delete with REVIEW and does not treat it as ALLOW", () => {
    const result = evaluateZeltaProtection({
      agent: mockAgent(["delete_crm_record"]),
      toolName: "delete_crm_record",
      actionType: "crm.delete",
      payload: { customerId: "cus_12345" },
    });

    assert.equal(result.decision, "REVIEW");
    assert.notEqual(result.decision, "ALLOW");
  });

  it("does not execute an approved action while the proposal is still pending", async () => {
    let executed = false;
    setApprovalGateProposalLookupForTests(async () => ({
      id: "44444444-4444-4444-8444-444444444444",
      organization_id: "11111111-1111-4111-8111-111111111111",
      agent_id: "crm-agent",
      tool_name: "delete_crm_record",
      action_type: "crm.delete",
      action_payload: {
        customerId: "cus_12345",
        _zeltaRuntimeRunId: "run-1",
        _zeltaBuilderAgentId: "00000000-0000-4000-8000-000000000001",
      },
      action_hash: "hash",
      plain_english_summary: "Delete customer",
      risk_level: "high",
      risk_score: 80,
      risk_reasons: {},
      policy_decision: "review",
      status: "review_required",
      requested_by: null,
      idempotency_key: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 86_400_000).toISOString(),
      review_expires_at: new Date(Date.now() + 86_400_000).toISOString(),
      decided_at: null,
      executed_at: null,
    }));
    setApprovalGateToolExecutorForTests(async () => {
      executed = true;
      return { executed: true, output: { deleted: true } };
    });

    const outcome = await executeApprovedAction({
      admin: {} as SupabaseClient,
      proposalId: "44444444-4444-4444-8444-444444444444",
      passportId: "00000000-0000-4000-8000-000000000099",
      toolName: "delete_crm_record",
      toolInput: { customerId: "cus_12345" },
      actionType: "crm.delete",
      context: {
        agent: mockAgent(["delete_crm_record"]),
        runId: "run-1",
        userId: "user",
        organizationId: "11111111-1111-4111-8111-111111111111",
      },
    });

    assert.equal(outcome.executed, false);
    assert.equal(executed, false);
  });
});
