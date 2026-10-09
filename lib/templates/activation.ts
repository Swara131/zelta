import type { AgentSafetySettings, BuilderAgentRecord } from "@/lib/agents/runtime-types";
import type { TemplateRiskLevel } from "./types";

export class TemplateActivationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TemplateActivationError";
  }
}

export function getTemplateRiskFromSafety(
  safety: AgentSafetySettings | undefined | null
): TemplateRiskLevel | null {
  const level = safety?.template?.riskLevel;
  if (level === "low" || level === "medium" || level === "high") return level;
  return null;
}

export function isHighRiskTemplateAgent(agent: Pick<BuilderAgentRecord, "safetySettings">): boolean {
  return getTemplateRiskFromSafety(agent.safetySettings) === "high";
}

/** Only high-risk *template* agents are gated. Builder/connect/workflow agents are unaffected. */
export function assertTemplateAgentCanActivate(
  agent: Pick<BuilderAgentRecord, "safetySettings" | "name">
): void {
  if (!isHighRiskTemplateAgent(agent)) return;
  const reviewed = agent.safetySettings.template?.permissionsReviewedAt;
  if (!reviewed) {
    throw new TemplateActivationError(
      "Review this template’s permissions and approval rules before activating a high-risk agent."
    );
  }
}

export function markTemplatePermissionsReviewed(
  safety: AgentSafetySettings
): AgentSafetySettings {
  if (!safety.template) return safety;
  return {
    ...safety,
    template: {
      ...safety.template,
      permissionsReviewedAt: new Date().toISOString(),
    },
  };
}
