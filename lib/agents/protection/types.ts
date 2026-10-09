import type { MatchedPolicyReason, PolicyDecisionOutcome } from "@/lib/gateway/policy/types";
import type { DeterministicRiskSignal } from "@/lib/gateway/risk/signals";
import type { RiskSeverity } from "@/lib/risk-types";

export interface ProtectionEvaluationResult {
  decision: PolicyDecisionOutcome;
  reason: string;
  why: string;
  riskLevel: RiskSeverity;
  riskScore: number;
  matchedPolicies: MatchedPolicyReason[];
  riskSignals: DeterministicRiskSignal[];
  plainEnglishSummary: string;
  actionDetails: Record<string, unknown>;
}

export interface PendingRuntimeApproval {
  proposalId: string;
  passportId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  actionType: string;
  agentActionId: string | null;
  turns: number;
  toolCalls: number;
  actionSequence: number;
  messages: Array<{ role: string; content: string }>;
  protectionReason: string;
  riskLevel: RiskSeverity;
  workflowNodeIndex?: number;
  lastToolName?: string | null;
  lastToolOutput?: Record<string, unknown>;
  summary?: string;
}
