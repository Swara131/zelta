export type SafetyDecisionLabel = "ALLOW" | "REQUIRE_APPROVAL" | "BLOCK";

export interface SafetyOverviewStats {
  protectedAgents: number;
  actionsAllowed: number;
  actionsRequireApproval: number;
  actionsBlocked: number;
  activeSafetyIssues: number;
}

export interface SafetyPolicyRow {
  id: string;
  name: string;
  agentId: string | null;
  agentName: string | null;
  agentSlug: string | null;
  rule: string;
  decision: SafetyDecisionLabel;
  status: "active" | "pending_review" | "triggered";
  source: "platform" | "agent" | "live";
}

export interface AgentMissionRow {
  agentId: string;
  agentSlug: string;
  agentName: string;
  missionGoal: string | null;
  allowedTools: string[];
  restrictions: string[];
  protectionStatus: "active" | "paused" | "inactive";
  hasExplicitMissionLock: boolean;
}

export interface SafetyEventRow {
  id: string;
  timestamp: string;
  agentId: string | null;
  agentName: string;
  agentSlug: string | null;
  action: string;
  toolName: string | null;
  decision: SafetyDecisionLabel;
  reason: string;
  status: string;
  proposalId: string | null;
  runtimeEvent: string | null;
}

export interface SafetyEventDetail {
  id: string;
  timestamp: string;
  agent: {
    id: string | null;
    slug: string | null;
    name: string;
    gatewayAgentId: string | null;
  };
  mission: string | null;
  tool: string | null;
  action: string | null;
  parameters: Record<string, unknown>;
  policyDecision: string | null;
  missionDecision: string | null;
  riskDecision: string | null;
  passport: {
    id: string | null;
    status: string | null;
    expiresAt: string | null;
    hashVerified: boolean | null;
  };
  approval: {
    status: string | null;
    decidedAt: string | null;
  };
  execution: {
    status: string | null;
    executedAt: string | null;
  };
  founderSummary: string;
  founderReason: string;
}

export interface SafetyCenterPayload {
  overview: SafetyOverviewStats;
  policies: SafetyPolicyRow[];
  missions: AgentMissionRow[];
  events: SafetyEventRow[];
}
