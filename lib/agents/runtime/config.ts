import { getGroqModel } from "@/lib/groq/env";
import type { BuilderAgentRecord } from "../runtime-types";
import type { RuntimeLimits } from "./types";

export const DEFAULT_RUNTIME_LIMITS: RuntimeLimits = {
  maxToolCalls: 8,
  maxTurns: 12,
  maxDurationMs: 120_000,
  maxRetries: 2,
};

export function resolveRuntimeLimits(agent: BuilderAgentRecord): RuntimeLimits {
  const safety = agent.safetySettings ?? {};

  return {
    maxToolCalls: safety.maxToolCallsPerRun ?? DEFAULT_RUNTIME_LIMITS.maxToolCalls,
    maxTurns: DEFAULT_RUNTIME_LIMITS.maxTurns,
    maxDurationMs: safety.maxRunDurationMs ?? DEFAULT_RUNTIME_LIMITS.maxDurationMs,
    maxRetries: DEFAULT_RUNTIME_LIMITS.maxRetries,
  };
}

export function resolveAgentModel(agent: BuilderAgentRecord): string {
  if (agent.model?.trim()) return agent.model.trim();
  return getGroqModel();
}
