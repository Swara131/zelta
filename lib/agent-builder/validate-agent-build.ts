import type { AgentBuildView } from "@/lib/agent-builder/build-response";
import type { AllowedTriggerType } from "@/lib/xai/parse-agent-build";
import { ALLOWED_TRIGGER_TYPES } from "@/lib/xai/parse-agent-build";

export const VALID_TRIGGER_TYPES = ALLOWED_TRIGGER_TYPES;

export type AgentBuildFieldErrors = {
  name?: string;
  tools?: string;
  triggerType?: string;
  suggestedThreshold?: string;
};

export interface AgentBuildValidationResult {
  valid: boolean;
  errors: string[];
  fieldErrors: AgentBuildFieldErrors;
  normalizedTrigger: AllowedTriggerType | null;
}

const VALID_TRIGGER_SET = new Set<string>(VALID_TRIGGER_TYPES);

export function normalizeTriggerType(
  trigger: string | undefined | null
): AllowedTriggerType | null {
  if (!trigger?.trim()) return null;
  const normalized = trigger.trim().toLowerCase();
  if (VALID_TRIGGER_SET.has(normalized)) {
    return normalized as AllowedTriggerType;
  }
  return null;
}

/** User-facing label — stored value stays lowercase. */
export function formatTriggerDisplay(trigger: AllowedTriggerType): string {
  return trigger.charAt(0).toUpperCase() + trigger.slice(1);
}

export function validateAgentBuildView(build: AgentBuildView): AgentBuildValidationResult {
  const fieldErrors: AgentBuildFieldErrors = {};
  const errors: string[] = [];

  const name = build.spec.name?.trim() ?? "";
  if (!name) {
    fieldErrors.name = "Agent name is required";
    errors.push(fieldErrors.name);
  } else if (name.length <= 3) {
    fieldErrors.name = "Agent name must be more than 3 characters";
    errors.push(fieldErrors.name);
  }

  const tools = build.spec.tools ?? [];
  if (tools.length === 0) {
    fieldErrors.tools =
      "No tools selected. Please describe an agent that uses at least one action";
    errors.push(fieldErrors.tools);
  }

  const normalizedTrigger = normalizeTriggerType(build.triggerType);
  if (!normalizedTrigger) {
    fieldErrors.triggerType =
      "Invalid trigger type. Must be email, webhook, or schedule";
    errors.push(fieldErrors.triggerType);
  }

  const threshold = build.suggestedThreshold ?? build.suggestedThresholdInr;
  if (threshold != null && (!Number.isInteger(threshold) || threshold <= 0)) {
    fieldErrors.suggestedThreshold = "Threshold must be a positive whole number";
    errors.push(fieldErrors.suggestedThreshold);
  }

  return {
    valid: errors.length === 0,
    errors,
    fieldErrors,
    normalizedTrigger,
  };
}

/** Normalize build view before POST — lowercase trigger, valid spec source for API. */
export function normalizeAgentBuildForCreate(build: AgentBuildView): AgentBuildView {
  const validation = validateAgentBuildView(build);
  const triggerType = validation.normalizedTrigger ?? "webhook";

  return {
    ...build,
    triggerType,
    spec: {
      ...build.spec,
      source: build.spec.source === "grok" ? "groq" : build.spec.source,
    },
  };
}
