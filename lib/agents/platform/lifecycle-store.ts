import type { AgentSafetySettings } from "@/lib/agents/runtime-types";
import {
  createDefaultPlatformLifecycle,
  type AgentPlatformLifecycle,
} from "./lifecycle-types";

export function readPlatformLifecycle(
  safetySettings: AgentSafetySettings | null | undefined
): AgentPlatformLifecycle {
  const stored = safetySettings?.platformLifecycle as AgentPlatformLifecycle | undefined;
  if (!stored) return createDefaultPlatformLifecycle();
  return {
    ...createDefaultPlatformLifecycle(),
    ...stored,
    checks: stored.checks?.length ? stored.checks : createDefaultPlatformLifecycle().checks,
    deployment: {
      ...createDefaultPlatformLifecycle().deployment,
      ...stored.deployment,
    },
  };
}

export function writePlatformLifecycle(
  safetySettings: AgentSafetySettings,
  lifecycle: AgentPlatformLifecycle
): AgentSafetySettings {
  return {
    ...safetySettings,
    platformLifecycle: {
      ...lifecycle,
      updatedAt: new Date().toISOString(),
    },
  };
}
