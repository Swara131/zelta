import type { RiskSeverity } from "@/lib/risk-types";
import type {
  AgentMission,
  AgentSafetySettingsExtended,
  MissionRestriction,
  SafetyPolicy,
} from "@/lib/agents/runtime-types";
import type { LoadedAgent } from "@/lib/agents/runtime/types";

export type { AgentMission, AgentSafetySettingsExtended, MissionRestriction, SafetyPolicy };

/** Final safety gate outcomes exposed to callers. */
export type SafetyDecision = "ALLOW" | "REQUIRE_APPROVAL" | "BLOCK";

export interface SafetyEvaluationContext {
  agent: LoadedAgent;
  tool: string;
  action: string;
  parameters: Record<string, unknown>;
  runId?: string | null;
  actionId?: string | null;
  source?: string;
}

export interface SafetyEvaluationResult {
  decision: SafetyDecision;
  reason: string;
  why: string;
  policyId: string | null;
  riskLevel: RiskSeverity;
  riskScore: number;
  canExecute: boolean;
  plainEnglishSummary: string;
  matchedPolicies: Array<{
    policyId: string;
    name: string;
    decision: SafetyDecision;
    reason: string;
  }>;
  mission: AgentMission;
  sanitizedParameters: Record<string, unknown>;
}
