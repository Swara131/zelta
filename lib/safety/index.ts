export type {
  AgentMission,
  SafetyDecision,
  SafetyEvaluationContext,
  SafetyEvaluationResult,
  SafetyPolicy,
  MissionRestriction,
  AgentSafetySettingsExtended,
} from "./types";

export {
  evaluateAction,
  evaluateActionPure,
  evaluateActionWithAudit,
  defaultSafetyDecisionForUnknownAction,
} from "./gate";

export {
  resolveAgentMission,
  isReadOnlyTool,
  isFinancialTool,
  hasExplicitMissionLock,
  missionConfigEnablesLock,
} from "./mission";
export {
  validateMissionAction,
  type MissionValidationInput,
  type MissionValidationResult,
} from "./mission-validation";
export { resolveToolsFromCapabilities, MISSION_CAPABILITY_TOOL_MAP } from "./mission-capabilities";
export { buildSafetyPolicyRulesForAgent, safetyPoliciesToRules } from "./policies";
export { sanitizeActionParameters } from "./sanitize";
export {
  createActionPassport,
  verifyActionPassport,
  revokeActionPassport,
  consumeActionPassport,
} from "./passport/service";
export { executeAuthorizedTool } from "./passport/execute-authorized";
export {
  ACTION_PASSPORT_TTL_SECONDS,
  ACTION_HASH_MISMATCH_MESSAGE,
  PASSPORT_MISMATCH_MESSAGE,
} from "./passport/constants";
export {
  canonicalizePassportAction,
  computePassportActionHash,
  type ActionHashInput,
} from "./passport/canonicalize";
export {
  generateActionHash,
  verifyActionHash,
  compareActionHashes,
} from "./passport/action-hash";
export {
  createPendingActionPassport,
} from "./passport/service";
export {
  bindApprovalPassport,
  executeApprovedAction,
  revokeApprovalPassport,
} from "./approval-gate/gate";
export {
  APPROVAL_GATE_DENIED_MESSAGE,
  APPROVAL_GATE_EXPIRED_MESSAGE,
  APPROVAL_GATE_INVALID_MESSAGE,
} from "./approval-gate/constants";
