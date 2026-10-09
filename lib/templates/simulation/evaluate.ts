import { hashSimulationInputs } from "./hash";
import {
  PENDING_APPROVAL_TTL_MS,
  SIMULATION_DISCLAIMER,
  SIMULATION_POLICY_VERSION,
  type DemoAction,
  type DemoScenario,
  type SimulationPendingApproval,
  type SimulationRun,
  type SimulationRunStep,
  type TestRunStatus,
} from "./types";

export function resolveAction(scenario: DemoScenario, actionId: string): DemoAction | null {
  return scenario.actions.find((action) => action.id === actionId) ?? null;
}

export function serverRequiresApproval(action: DemoAction): boolean {
  return action.requiresApproval || action.riskLevel === "high";
}

export function serverBlocksAction(action: DemoAction, inputs: Record<string, string>): boolean {
  const blob = Object.values(inputs).join(" ").toLowerCase();
  if (action.simulatedTool === "issue_refund" && /delete|wipe|database/.test(blob)) {
    return true;
  }
  return false;
}

function buildSteps(
  scenario: DemoScenario,
  action: DemoAction,
  inputs: Record<string, string>,
  finalStatus: "succeeded" | "blocked"
): SimulationRunStep[] {
  const now = Date.now();
  const inputSummary = Object.entries(inputs)
    .map(([key, value]) => `${key}: ${value.slice(0, 80)}`)
    .join("; ");

  return scenario.expectedSteps.map((step, index) => {
    const last = index === scenario.expectedSteps.length - 1;
    return {
      id: step.id,
      label: step.label,
      status: last ? finalStatus : "succeeded",
      inputSummary,
      output: last ? action.simulatedResult : `${step.label} finished in sandbox.`,
      durationMs: 40 + index * 12,
      timestamp: new Date(now + index * 15).toISOString(),
      policyDecision: action.requiresApproval ? "REVIEW" : "ALLOW",
      approvalRequired: action.requiresApproval,
    };
  });
}

export function createEvaluatingRun(params: {
  runId: string;
  correlationId: string;
  agentId: string;
  workspaceId: string;
  userId: string;
  scenario: DemoScenario;
  action: DemoAction;
  inputs: Record<string, string>;
}): SimulationRun {
  const inputHash = hashSimulationInputs(params.action.id, params.inputs);
  const createdAt = new Date().toISOString();
  return {
    id: params.runId,
    correlationId: params.correlationId,
    agentId: params.agentId,
    workspaceId: params.workspaceId,
    templateSlug: params.scenario.templateSlug,
    actionId: params.action.id,
    status: "evaluating",
    inputs: params.inputs,
    inputHash,
    steps: [],
    resultSummary: null,
    disclaimer: SIMULATION_DISCLAIMER,
    pending: null,
    createdAt,
    updatedAt: createdAt,
  };
}

export function applyPolicyDecision(params: {
  run: SimulationRun;
  scenario: DemoScenario;
  action: DemoAction;
  userId: string;
}): SimulationRun {
  if (serverBlocksAction(params.action, params.run.inputs)) {
    return {
      ...params.run,
      status: "blocked",
      steps: buildSteps(params.scenario, params.action, params.run.inputs, "blocked"),
      resultSummary:
        "Blocked because the sample policy does not allow this combination of action and input.",
      updatedAt: new Date().toISOString(),
    };
  }

  if (serverRequiresApproval(params.action)) {
    const pending: SimulationPendingApproval = {
      approvalId: `apr-${params.run.id}`,
      runId: params.run.id,
      actionId: params.action.id,
      inputHash: params.run.inputHash,
      userId: params.userId,
      workspaceId: params.run.workspaceId,
      agentId: params.run.agentId,
      templateSlug: params.run.templateSlug,
      policyVersion: SIMULATION_POLICY_VERSION,
      expiresAt: new Date(Date.now() + PENDING_APPROVAL_TTL_MS).toISOString(),
      reason:
        "Approval required because this action would touch an external or high-impact tool. In Simulation mode, nothing is sent or charged. Approve the simulation to view the expected workflow result.",
      policy: `${SIMULATION_POLICY_VERSION}:${params.action.simulatedTool}`,
    };
    return {
      ...params.run,
      status: "approval_required",
      pending,
      resultSummary: pending.reason,
      updatedAt: new Date().toISOString(),
    };
  }

  return completeSimulation(params.run, params.scenario, params.action);
}

export function completeSimulation(
  run: SimulationRun,
  scenario: DemoScenario,
  action: DemoAction
): SimulationRun {
  return {
    ...run,
    status: "completed",
    pending: null,
    steps: buildSteps(scenario, action, run.inputs, "succeeded"),
    resultSummary: `${action.simulatedResult} ${SIMULATION_DISCLAIMER}`,
    updatedAt: new Date().toISOString(),
  };
}

export function rejectSimulation(run: SimulationRun): SimulationRun {
  return {
    ...run,
    status: "rejected",
    pending: null,
    resultSummary: "Rejected — the simulation was not executed.",
    updatedAt: new Date().toISOString(),
  };
}

export function assertPendingMatches(params: {
  pending: SimulationPendingApproval;
  userId: string;
  workspaceId: string;
  agentId: string;
  actionId: string;
  inputHash: string;
}): void {
  const { pending } = params;
  if (pending.userId !== params.userId) throw new Error("Approval is not for this user.");
  if (pending.workspaceId !== params.workspaceId) {
    throw new Error("Approval is not for this workspace.");
  }
  if (pending.agentId !== params.agentId) throw new Error("Approval is not for this agent.");
  if (pending.actionId !== params.actionId) throw new Error("Approval is not for this action.");
  if (pending.inputHash !== params.inputHash) {
    throw new Error("Inputs changed. Request a new simulation approval.");
  }
  if (pending.policyVersion !== SIMULATION_POLICY_VERSION) {
    throw new Error("Policy version changed. Request a new approval.");
  }
  if (Date.parse(pending.expiresAt) < Date.now()) {
    throw new Error("This approval expired. Run the simulation again.");
  }
}

export function nextStatusAfterEvaluate(status: TestRunStatus): boolean {
  return (
    status === "completed" ||
    status === "approval_required" ||
    status === "blocked" ||
    status === "failed"
  );
}
