/** Protection preset — controls default approval posture. */
export type ProtectionMode = "safe" | "balanced" | "autonomous";

export type SafetyScoreStatus = "protected" | "needs_attention" | "high_risk";

export type ToolPermissionLevel =
  | "disabled"
  | "read_only"
  | "draft_only"
  | "ask_approval"
  | "automatic";

export type IncidentSeverity = "info" | "warning" | "blocked" | "critical";

export type ApprovalRuleKey =
  | "send_message"
  | "publish_content"
  | "delete_data"
  | "process_payments"
  | "change_production_code"
  | "export_customer_data"
  | "access_secrets";

export interface DataProtectionSettings {
  promptInjectionDefense: boolean;
  secretDetection: boolean;
  piiDetection: boolean;
  blockPromptExtraction: boolean;
  restrictSensitiveKb: boolean;
}

export interface AgentSafetyPolicyRecord {
  id: string;
  agentId: string;
  organizationId: string;
  protectionMode: ProtectionMode;
  dataProtection: DataProtectionSettings;
  lastCheckedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AgentToolPermissionRecord {
  id: string;
  agentId: string;
  organizationId: string;
  toolId: string;
  toolLabel: string;
  permissionLevel: ToolPermissionLevel;
  isHighRisk: boolean;
  revokedAt: string | null;
}

export interface AgentApprovalRuleRecord {
  id: string;
  agentId: string;
  organizationId: string;
  ruleKey: ApprovalRuleKey;
  enabled: boolean;
  thresholdValue: number | null;
  thresholdUnit: string | null;
}

export interface AgentExecutionLimitRecord {
  id: string;
  agentId: string;
  organizationId: string;
  maxCostPerRunUsd: number | null;
  dailySpendingCapUsd: number | null;
  maxToolCallsPerRun: number | null;
  maxExecutionTimeSeconds: number | null;
  maxRetries: number | null;
  maxMessagesPerRun: number | null;
}

export interface SafetyIncidentRecord {
  id: string;
  agentId: string;
  organizationId: string;
  severity: IncidentSeverity;
  title: string;
  explanation: string;
  relatedTool: string | null;
  runId: string | null;
  actionTaken: string;
  isSample: boolean;
  createdAt: string;
}

export interface SafetyScoreFactor {
  id: string;
  label: string;
  impact: number;
  direction: "positive" | "negative";
}

export interface SafetyRecommendation {
  id: string;
  message: string;
  severity: "low" | "medium" | "high";
  fixAction: string;
  fixPayload?: Record<string, unknown>;
}

export interface SafetyEvaluationResult {
  score: number;
  status: SafetyScoreStatus;
  factors: SafetyScoreFactor[];
  recommendations: SafetyRecommendation[];
}

export interface SafetyAutopilotSnapshot {
  agent: {
    id: string;
    slug: string;
    name: string;
    status: string;
    displayStatus: "active" | "paused";
  };
  policy: AgentSafetyPolicyRecord;
  permissions: AgentToolPermissionRecord[];
  approvalRules: AgentApprovalRuleRecord[];
  limits: AgentExecutionLimitRecord;
  evaluation: SafetyEvaluationResult;
  policySummary: string[];
  incidents: SafetyIncidentRecord[];
  hasSampleIncidents: boolean;
}

export type EmergencyAction =
  | "pause_agent"
  | "resume_agent"
  | "revoke_permissions"
  | "kill_active_runs";
