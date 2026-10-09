export type SimulationRiskLevel = "low" | "medium" | "high";

export type TestRunStatus =
  | "idle"
  | "preparing"
  | "evaluating"
  | "approval_required"
  | "approved"
  | "rejected"
  | "executing_simulation"
  | "completed"
  | "blocked"
  | "failed";

export type DemoStepStatus = "queued" | "running" | "succeeded" | "blocked" | "failed";

export interface DemoInputField {
  id: string;
  label: string;
  placeholder: string;
  example: string;
  multiline?: boolean;
}

export interface DemoAction {
  id: string;
  label: string;
  description: string;
  riskLevel: SimulationRiskLevel;
  requiresApproval: boolean;
  simulatedTool: string;
  simulatedResult: string;
}

export interface DemoStep {
  id: string;
  label: string;
}

export interface DemoScenario {
  id: string;
  templateSlug: string;
  title: string;
  description: string;
  whatItDoes: string;
  whatItWillNotDo: string;
  mode: "simulation";
  actions: DemoAction[];
  inputFields: DemoInputField[];
  expectedSteps: DemoStep[];
  riskLevel: SimulationRiskLevel;
  tools: string[];
}

export interface SimulationRunStep {
  id: string;
  label: string;
  status: DemoStepStatus;
  inputSummary: string;
  output: string;
  durationMs: number;
  timestamp: string;
  policyDecision: string;
  approvalRequired: boolean;
}

export interface SimulationPendingApproval {
  approvalId: string;
  runId: string;
  actionId: string;
  inputHash: string;
  userId: string;
  workspaceId: string;
  agentId: string;
  templateSlug: string;
  policyVersion: string;
  expiresAt: string;
  reason: string;
  policy: string;
}

export interface SimulationRun {
  id: string;
  correlationId: string;
  agentId: string;
  workspaceId: string;
  templateSlug: string;
  actionId: string;
  status: TestRunStatus;
  inputs: Record<string, string>;
  inputHash: string;
  steps: SimulationRunStep[];
  resultSummary: string | null;
  disclaimer: string;
  pending: SimulationPendingApproval | null;
  createdAt: string;
  updatedAt: string;
}

export const SIMULATION_DISCLAIMER =
  "Simulation completed — no real external action was performed.";

export const SIMULATION_POLICY_VERSION = "template-sim-v1";
export const PENDING_APPROVAL_TTL_MS = 15 * 60 * 1000;
