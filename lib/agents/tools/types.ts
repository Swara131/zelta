import type { ToolHandlerContext, ToolExecutionOutcome } from "../runtime/types";

export type ToolRiskLevel = "low" | "medium" | "high" | "critical";

export type ToolConnectionProvider =
  | "resend"
  | "web_search"
  | "google_sheets"
  | "x_api"
  | "twilio"
  | "zelta"
  | "none";

export type ToolConnectionStatus = "connected" | "disconnected" | "error";

export interface ToolConnectionRequirement {
  provider: ToolConnectionProvider;
  label: string;
  description: string;
  /** Platform env vars that satisfy this connection when all are set. */
  envVars?: string[];
  /** At least one of these env vars satisfies the connection. */
  envVarsAny?: string[];
  /** In-app settings path for user-facing setup. */
  settingsPath?: string;
}

export interface ToolSchema {
  type: "object";
  properties: Record<string, { type: string; description?: string }>;
  required?: string[];
}

export type ToolHandler = (
  input: Record<string, unknown>,
  context: ToolHandlerContext
) => Promise<ToolExecutionOutcome>;

export interface ZeltaToolDefinition {
  name: string;
  label: string;
  description: string;
  inputSchema: ToolSchema;
  outputSchema: ToolSchema;
  actionType: string;
  riskLevel: ToolRiskLevel;
  permissions: ToolConnectionRequirement[];
  handler: ToolHandler;
}

export interface ToolConnectionRecord {
  provider: ToolConnectionProvider;
  status: ToolConnectionStatus;
  label: string;
  description: string;
  missingRequirements: string[];
  settingsPath?: string;
}
