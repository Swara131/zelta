export { evaluateZeltaProtection } from "./evaluator";
export {
  getZeltaProtectionPolicies,
  buildAgentSafetyPolicyRules,
  ZELTA_PROTECTION_POLICIES,
} from "./rules";
export {
  buildProtectionSummary,
  riskLevelLabel,
  primaryPolicyReason,
} from "./summaries";
export {
  handleRuntimeProposalDecision,
  isRuntimeAgentProposal,
} from "./runtime-bridge";
export type { ProtectionEvaluationResult, PendingRuntimeApproval } from "./types";
