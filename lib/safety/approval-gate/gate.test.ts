import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActionProposalRow } from "@/lib/gateway/proposals/repository";
import type { LoadedAgent } from "@/lib/agents/runtime/types";
import {
  bindApprovalPassport,
  executeApprovedAction,
  setApprovalGateProposalLookupForTests,
  setApprovalGateToolExecutorForTests,
} from "./gate";
import {
  APPROVAL_GATE_DENIED_MESSAGE,
  APPROVAL_GATE_EXPIRED_MESSAGE,
  APPROVAL_GATE_INVALID_MESSAGE,
} from "./constants";
import { createMemoryActionPassportStore } from "@/lib/safety/passport/memory-store";
import { setActionPassportStoreForTests } from "@/lib/safety/passport/service";

const ORG = "org-1";
const PROPOSAL_ID = "proposal-1";
const RUN_ID = "run-1";
const PASSPORT_PARAMS = {
  organizationId: ORG,
  builderAgentId: "agent-1",
  gatewayAgentId: "gw-1",
  agentRunId: RUN_ID,
  tool: "send_email",
  action: "communication.send_email",
  parameters: { recipient: "user@example.com", subject: "Hello" },
  missionGoal: "Notify users",
};

function buildAgent(): LoadedAgent {
  return {
    gatewayAgentId: "gw-1",
    enabledTools: ["send_email"],
    systemPrompt: "test",
    record: {
      id: "agent-1",
      userId: "user-1",
      organizationId: ORG,
      name: "Test",
      slug: "test",
      description: "Test agent",
      goal: "Notify users",
      instructions: null,
      model: null,
      source: "builder",
      tools: ["send_email"],
      capabilities: [],
      triggerType: "schedule",
      schedule: {},
      timezone: "UTC",
      memoryEnabled: false,
      safetySettings: {},
      suggestedThreshold: 5000,
      status: "active",
      publishedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };
}

function buildProposal(overrides: Partial<ActionProposalRow> = {}): ActionProposalRow {
  const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  return {
    id: PROPOSAL_ID,
    organization_id: ORG,
    agent_id: "gw-1",
    tool_name: "send_email",
    action_type: "communication.send_email",
    action_payload: {
      recipient: "user@example.com",
      subject: "Hello",
      _zeltaRuntimeRunId: RUN_ID,
      _zeltaBuilderAgentId: "agent-1",
    },
    action_hash: "gateway-hash",
    plain_english_summary: "Send email",
    risk_level: "medium",
    risk_score: 50,
    risk_reasons: {},
    policy_decision: "review",
    status: "executed",
    requested_by: "user-1",
    idempotency_key: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    expires_at: future,
    review_expires_at: future,
    decided_at: new Date().toISOString(),
    executed_at: new Date().toISOString(),
    ...overrides,
  };
}

const admin = {} as SupabaseClient;

const mockToolSuccess = async () => ({
  executed: true as const,
  output: { ok: true },
});

afterEach(() => {
  setActionPassportStoreForTests(null);
  setApprovalGateProposalLookupForTests(null);
  setApprovalGateToolExecutorForTests(null);
});

describe("Approval Gate", () => {
  it("binds a pending passport to a proposal", async () => {
    setActionPassportStoreForTests(createMemoryActionPassportStore());

    const bound = await bindApprovalPassport({
      admin,
      ...PASSPORT_PARAMS,
      proposalId: PROPOSAL_ID,
      agentActionId: null,
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    });

    assert.ok(bound.passportId);
    assert.ok(bound.actionHash);
  });

  it("executes after approval when approval, passport, and hash match", async () => {
    setActionPassportStoreForTests(createMemoryActionPassportStore());
    setApprovalGateProposalLookupForTests(async () => buildProposal());
    setApprovalGateToolExecutorForTests(mockToolSuccess);

    const bound = await bindApprovalPassport({
      admin,
      ...PASSPORT_PARAMS,
      proposalId: PROPOSAL_ID,
      agentActionId: null,
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    });

    const outcome = await executeApprovedAction({
      admin,
      proposalId: PROPOSAL_ID,
      passportId: bound.passportId,
      toolName: PASSPORT_PARAMS.tool,
      toolInput: PASSPORT_PARAMS.parameters,
      actionType: PASSPORT_PARAMS.action,
      context: {
        agent: buildAgent(),
        runId: RUN_ID,
        userId: "user-1",
        organizationId: ORG,
      },
      missionGoal: PASSPORT_PARAMS.missionGoal,
    });

    assert.equal(outcome.executed, true);
  });

  it("does not execute when approval was denied", async () => {
    setActionPassportStoreForTests(createMemoryActionPassportStore());
    setApprovalGateProposalLookupForTests(async () =>
      buildProposal({ status: "rejected" })
    );

    const bound = await bindApprovalPassport({
      admin,
      ...PASSPORT_PARAMS,
      proposalId: PROPOSAL_ID,
      agentActionId: null,
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    });

    const outcome = await executeApprovedAction({
      admin,
      proposalId: PROPOSAL_ID,
      passportId: bound.passportId,
      toolName: PASSPORT_PARAMS.tool,
      toolInput: PASSPORT_PARAMS.parameters,
      actionType: PASSPORT_PARAMS.action,
      context: {
        agent: buildAgent(),
        runId: RUN_ID,
        userId: "user-1",
        organizationId: ORG,
      },
    });

    assert.equal(outcome.executed, false);
    assert.equal(outcome.error, APPROVAL_GATE_DENIED_MESSAGE);
  });

  it("does not execute when approval expired", async () => {
    setActionPassportStoreForTests(createMemoryActionPassportStore());
    const past = new Date(Date.now() - 60_000).toISOString();
    setApprovalGateProposalLookupForTests(async () =>
      buildProposal({
        status: "approved",
        expires_at: past,
        review_expires_at: past,
      })
    );

    const bound = await bindApprovalPassport({
      admin,
      ...PASSPORT_PARAMS,
      proposalId: PROPOSAL_ID,
      agentActionId: null,
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    });

    const outcome = await executeApprovedAction({
      admin,
      proposalId: PROPOSAL_ID,
      passportId: bound.passportId,
      toolName: PASSPORT_PARAMS.tool,
      toolInput: PASSPORT_PARAMS.parameters,
      actionType: PASSPORT_PARAMS.action,
      context: {
        agent: buildAgent(),
        runId: RUN_ID,
        userId: "user-1",
        organizationId: ORG,
      },
    });

    assert.equal(outcome.executed, false);
    assert.equal(outcome.error, APPROVAL_GATE_EXPIRED_MESSAGE);
  });

  it("does not execute when action parameters were modified after approval", async () => {
    setActionPassportStoreForTests(createMemoryActionPassportStore());
    setApprovalGateProposalLookupForTests(async () => buildProposal());

    const bound = await bindApprovalPassport({
      admin,
      ...PASSPORT_PARAMS,
      proposalId: PROPOSAL_ID,
      agentActionId: null,
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    });

    const outcome = await executeApprovedAction({
      admin,
      proposalId: PROPOSAL_ID,
      passportId: bound.passportId,
      toolName: PASSPORT_PARAMS.tool,
      toolInput: { recipient: "attacker@example.com", subject: "Hello" },
      actionType: PASSPORT_PARAMS.action,
      context: {
        agent: buildAgent(),
        runId: RUN_ID,
        userId: "user-1",
        organizationId: ORG,
      },
      missionGoal: PASSPORT_PARAMS.missionGoal,
    });

    assert.equal(outcome.executed, false);
  });

  it("does not execute when passport was already consumed", async () => {
    setActionPassportStoreForTests(createMemoryActionPassportStore());
    setApprovalGateProposalLookupForTests(async () => buildProposal());
    setApprovalGateToolExecutorForTests(mockToolSuccess);

    const bound = await bindApprovalPassport({
      admin,
      ...PASSPORT_PARAMS,
      proposalId: PROPOSAL_ID,
      agentActionId: null,
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    });

    const context = {
      agent: buildAgent(),
      runId: RUN_ID,
      userId: "user-1",
      organizationId: ORG,
    };

    const first = await executeApprovedAction({
      admin,
      proposalId: PROPOSAL_ID,
      passportId: bound.passportId,
      toolName: PASSPORT_PARAMS.tool,
      toolInput: PASSPORT_PARAMS.parameters,
      actionType: PASSPORT_PARAMS.action,
      context,
      missionGoal: PASSPORT_PARAMS.missionGoal,
    });
    assert.equal(first.executed, true);

    const second = await executeApprovedAction({
      admin,
      proposalId: PROPOSAL_ID,
      passportId: bound.passportId,
      toolName: PASSPORT_PARAMS.tool,
      toolInput: PASSPORT_PARAMS.parameters,
      actionType: PASSPORT_PARAMS.action,
      context,
      missionGoal: PASSPORT_PARAMS.missionGoal,
    });

    assert.equal(second.executed, false);
  });

  it("does not execute when proposal is invalid for the run", async () => {
    setActionPassportStoreForTests(createMemoryActionPassportStore());
    setApprovalGateProposalLookupForTests(async () =>
      buildProposal({
        action_payload: {
          recipient: "user@example.com",
          _zeltaRuntimeRunId: "other-run",
          _zeltaBuilderAgentId: "agent-1",
        },
      })
    );

    const bound = await bindApprovalPassport({
      admin,
      ...PASSPORT_PARAMS,
      proposalId: PROPOSAL_ID,
      agentActionId: null,
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    });

    const outcome = await executeApprovedAction({
      admin,
      proposalId: PROPOSAL_ID,
      passportId: bound.passportId,
      toolName: PASSPORT_PARAMS.tool,
      toolInput: PASSPORT_PARAMS.parameters,
      actionType: PASSPORT_PARAMS.action,
      context: {
        agent: buildAgent(),
        runId: RUN_ID,
        userId: "user-1",
        organizationId: ORG,
      },
    });

    assert.equal(outcome.executed, false);
    assert.equal(outcome.error, APPROVAL_GATE_INVALID_MESSAGE);
  });
});
