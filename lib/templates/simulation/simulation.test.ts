import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyPolicyDecision,
  assertPendingMatches,
  completeSimulation,
  createEvaluatingRun,
  rejectSimulation,
  resolveAction,
  serverRequiresApproval,
} from "./evaluate";
import { hashSimulationInputs } from "./hash";
import { getDemoScenario, isGenericCustomerDemoTitle, listScenarioSlugs } from "./registry";

describe("template simulation registry", () => {
  it("loads Lead Researcher data", () => {
    const scenario = getDemoScenario("lead-researcher");
    assert.ok(scenario);
    assert.match(scenario.title, /Lead Researcher/i);
    assert.ok(scenario.inputFields.some((field) => field.id === "company"));
    assert.equal(isGenericCustomerDemoTitle(scenario.title), false);
  });

  it("loads Cold Email Drafter data", () => {
    const scenario = getDemoScenario("cold-email-drafter");
    assert.ok(scenario);
    assert.match(scenario.title, /Cold Email/i);
    assert.ok(scenario.actions.some((action) => /draft/i.test(action.label)));
  });

  it("creates two different scenario configurations", () => {
    const a = getDemoScenario("lead-researcher");
    const b = getDemoScenario("cold-email-drafter");
    assert.notEqual(a?.id, b?.id);
    assert.notEqual(a?.title, b?.title);
    assert.notEqual(a?.inputFields[0]?.id, b?.inputFields[0]?.id);
  });

  it("never uses Demo Customer scenario for marketplace templates", () => {
    for (const slug of listScenarioSlugs()) {
      const scenario = getDemoScenario(slug);
      assert.ok(scenario, slug);
      assert.equal(isGenericCustomerDemoTitle(scenario.title), false);
    }
  });

  it("shows a proper miss for unknown template slugs", () => {
    assert.equal(getDemoScenario("not-a-real-template"), null);
  });
});

describe("simulation state machine", () => {
  it("completes low-risk simulations without approval", () => {
    const scenario = getDemoScenario("lead-researcher")!;
    const action = resolveAction(scenario, "research-company")!;
    assert.equal(serverRequiresApproval(action), false);
    const run = applyPolicyDecision({
      run: createEvaluatingRun({
        runId: "run-1",
        correlationId: "c1",
        agentId: "lead-researcher-agent",
        workspaceId: "org-1",
        userId: "user-1",
        scenario,
        action,
        inputs: { company: "Northwind" },
      }),
      scenario,
      action,
      userId: "user-1",
    });
    assert.equal(run.status, "completed");
    assert.ok(run.resultSummary?.includes("no real external"));
  });

  it("enters approval_required for high-risk actions and stays there", () => {
    const scenario = getDemoScenario("refund-request-assistant")!;
    const action = resolveAction(scenario, "check-policy")!;
    const run = applyPolicyDecision({
      run: createEvaluatingRun({
        runId: "run-2",
        correlationId: "c2",
        agentId: "refund-agent",
        workspaceId: "org-1",
        userId: "user-1",
        scenario,
        action,
        inputs: { customer: "Asha", amount: "25000" },
      }),
      scenario,
      action,
      userId: "user-1",
    });
    assert.equal(run.status, "approval_required");
    assert.ok(run.pending);
    assert.ok(run.resultSummary?.includes("Approve the simulation"));
  });

  it("approves the exact action and completes the simulation", () => {
    const scenario = getDemoScenario("cold-email-drafter")!;
    const action = resolveAction(scenario, "send-draft-preview")!;
    const started = applyPolicyDecision({
      run: createEvaluatingRun({
        runId: "run-3",
        correlationId: "c3",
        agentId: "email-agent",
        workspaceId: "org-1",
        userId: "user-1",
        scenario,
        action,
        inputs: { lead: "Priya" },
      }),
      scenario,
      action,
      userId: "user-1",
    });
    assertPendingMatches({
      pending: started.pending!,
      userId: "user-1",
      workspaceId: "org-1",
      agentId: "email-agent",
      actionId: action.id,
      inputHash: started.inputHash,
    });
    const completed = completeSimulation(started, scenario, action);
    assert.equal(completed.status, "completed");
    assert.equal(completed.pending, null);
    assert.ok(completed.steps.length > 0);
  });

  it("rejects without executing", () => {
    const scenario = getDemoScenario("refund-request-assistant")!;
    const action = resolveAction(scenario, "check-policy")!;
    const started = applyPolicyDecision({
      run: createEvaluatingRun({
        runId: "run-4",
        correlationId: "c4",
        agentId: "refund-agent",
        workspaceId: "org-1",
        userId: "user-1",
        scenario,
        action,
        inputs: { customer: "Asha", amount: "25000" },
      }),
      scenario,
      action,
      userId: "user-1",
    });
    const rejected = rejectSimulation(started);
    assert.equal(rejected.status, "rejected");
    assert.match(rejected.resultSummary ?? "", /not executed/i);
  });

  it("invalidates approval when parameters change", () => {
    const scenario = getDemoScenario("refund-request-assistant")!;
    const action = resolveAction(scenario, "check-policy")!;
    const run = applyPolicyDecision({
      run: createEvaluatingRun({
        runId: "run-5",
        correlationId: "c5",
        agentId: "refund-agent",
        workspaceId: "org-1",
        userId: "user-1",
        scenario,
        action,
        inputs: { customer: "Asha", amount: "25000" },
      }),
      scenario,
      action,
      userId: "user-1",
    });
    assert.throws(
      () =>
        assertPendingMatches({
          pending: run.pending!,
          userId: "user-1",
          workspaceId: "org-1",
          agentId: "refund-agent",
          actionId: action.id,
          inputHash: hashSimulationInputs(action.id, { customer: "Asha", amount: "1" }),
        }),
      /Inputs changed/
    );
  });

  it("prevents replaying approval across workspaces", () => {
    const scenario = getDemoScenario("refund-request-assistant")!;
    const action = resolveAction(scenario, "check-policy")!;
    const run = applyPolicyDecision({
      run: createEvaluatingRun({
        runId: "run-6",
        correlationId: "c6",
        agentId: "refund-agent",
        workspaceId: "org-1",
        userId: "user-1",
        scenario,
        action,
        inputs: { customer: "Asha", amount: "25000" },
      }),
      scenario,
      action,
      userId: "user-1",
    });
    assert.throws(
      () =>
        assertPendingMatches({
          pending: run.pending!,
          userId: "user-1",
          workspaceId: "org-other",
          agentId: "refund-agent",
          actionId: action.id,
          inputHash: run.inputHash,
        }),
      /workspace/
    );
  });
});
