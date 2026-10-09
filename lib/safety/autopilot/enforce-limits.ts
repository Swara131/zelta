import type { AgentExecutionLimitRecord, SafetyIncidentRecord } from "./types";

export interface LimitCheckContext {
  estimatedCostUsd?: number;
  toolCallCount?: number;
  elapsedSeconds?: number;
  retryCount?: number;
  messageCount?: number;
}

export interface LimitCheckResult {
  allowed: boolean;
  violatedField: keyof AgentExecutionLimitRecord | null;
  message: string | null;
}

export function checkExecutionLimits(
  limits: AgentExecutionLimitRecord,
  context: LimitCheckContext
): LimitCheckResult {
  if (
    limits.maxCostPerRunUsd != null &&
    context.estimatedCostUsd != null &&
    context.estimatedCostUsd > limits.maxCostPerRunUsd
  ) {
    return {
      allowed: false,
      violatedField: "maxCostPerRunUsd",
      message: `Run cost ($${context.estimatedCostUsd}) exceeds the per-run cap ($${limits.maxCostPerRunUsd}).`,
    };
  }
  if (
    limits.maxToolCallsPerRun != null &&
    context.toolCallCount != null &&
    context.toolCallCount > limits.maxToolCallsPerRun
  ) {
    return {
      allowed: false,
      violatedField: "maxToolCallsPerRun",
      message: `Tool calls (${context.toolCallCount}) exceed the per-run limit (${limits.maxToolCallsPerRun}).`,
    };
  }
  if (
    limits.maxExecutionTimeSeconds != null &&
    context.elapsedSeconds != null &&
    context.elapsedSeconds > limits.maxExecutionTimeSeconds
  ) {
    return {
      allowed: false,
      violatedField: "maxExecutionTimeSeconds",
      message: `Execution time exceeded the ${limits.maxExecutionTimeSeconds}s limit.`,
    };
  }
  if (
    limits.maxRetries != null &&
    context.retryCount != null &&
    context.retryCount > limits.maxRetries
  ) {
    return {
      allowed: false,
      violatedField: "maxRetries",
      message: `Retry count (${context.retryCount}) exceeds the limit (${limits.maxRetries}).`,
    };
  }
  if (
    limits.maxMessagesPerRun != null &&
    context.messageCount != null &&
    context.messageCount > limits.maxMessagesPerRun
  ) {
    return {
      allowed: false,
      violatedField: "maxMessagesPerRun",
      message: `Messages (${context.messageCount}) exceed the per-run limit (${limits.maxMessagesPerRun}).`,
    };
  }
  return { allowed: true, violatedField: null, message: null };
}

export function buildLimitIncident(
  agentId: string,
  organizationId: string,
  result: LimitCheckResult,
  runId?: string | null
): Omit<SafetyIncidentRecord, "id" | "createdAt"> {
  return {
    agentId,
    organizationId,
    severity: "blocked",
    title: "Execution limit exceeded",
    explanation: result.message ?? "An execution limit was exceeded.",
    relatedTool: null,
    runId: runId ?? null,
    actionTaken: "Run blocked",
    isSample: false,
  };
}
