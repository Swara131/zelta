import type { AgentConnectionPlatformId } from "@/lib/agents/platform/connection-options";

/** Connection methods actually supported by the backend today. MCP is intentionally omitted. */
export type ExternalConnectionMethod = "rest_api" | "webhook" | "sdk";

export type ExternalTestCheckId = "connection" | "response" | "execution" | "output";

export type ExternalTestCheckStatus = "not_run" | "pass" | "fail" | "skipped";

export interface ExternalTestCheck {
  id: ExternalTestCheckId;
  label: string;
  status: ExternalTestCheckStatus;
  message?: string;
}

export interface ExternalAgentConnection {
  origin: "zelta" | "external";
  platform: AgentConnectionPlatformId;
  connectionMethod: ExternalConnectionMethod;
  agentName: string;
  agentSlug: string;
  endpointUrl?: string | null;
  authType?: "none" | "bearer" | "api_key_header";
  authHeaderName?: string | null;
  /** Never store plaintext secrets — only whether auth was provided at last test. */
  authConfigured: boolean;
  connectionVerifiedAt?: string | null;
  lastTestAt?: string | null;
  lastTestPassed?: boolean;
  lastTestChecks?: ExternalTestCheck[];
  safetyEligible: boolean;
  safetyMessage?: string | null;
  deployedAt?: string | null;
  deploymentState?: "idle" | "deployed" | "failed" | "needs_attention";
  updatedAt: string;
}

export interface ExternalTestResult {
  passed: boolean;
  needsAttention: boolean;
  checks: ExternalTestCheck[];
  summary: string;
  safetyEligible: boolean;
  safetyMessage: string;
}
