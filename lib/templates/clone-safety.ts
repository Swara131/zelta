import type { AgentSafetySettings } from "@/lib/agents/runtime-types";
import type { AgentTemplate, TemplateCustomizations } from "./types";
import { safetyDefaultsForRisk } from "./safety-defaults";

export function buildSafetySettingsFromTemplate(
  template: AgentTemplate,
  customizations: TemplateCustomizations
): AgentSafetySettings {
  const risk = template.riskLevel ?? "medium";
  const defaults = safetyDefaultsForRisk(risk, template.tools);
  const needsApproval =
    customizations.needsApproval || defaults.requiresApproval || risk === "high";

  return {
    template: {
      id: template.id,
      name: template.name,
      slug: template.slug ?? template.id,
      riskLevel: risk,
      permissionsReviewedAt: null,
    },
    requireApprovalFor: needsApproval ? defaults.requireApprovalFor : [],
    maxToolCallsPerRun: defaults.executionLimits.maxToolCallsPerRun,
    maxRunDurationMs: defaults.executionLimits.maxRunDurationMs,
    thresholdInr: template.supportsThreshold
      ? customizations.threshold ?? template.defaultThreshold ?? 5000
      : undefined,
    autoAllowBelowThreshold: !needsApproval && risk === "low",
  };
}

export function resolveAutoAllow(
  template: AgentTemplate,
  customizations: TemplateCustomizations
): boolean {
  const risk = template.riskLevel ?? "medium";
  const defaults = safetyDefaultsForRisk(risk, template.tools);
  if (risk === "high") return false;
  if (defaults.requiresApproval || customizations.needsApproval) return false;
  return true;
}

export function shouldStartPaused(template: AgentTemplate): boolean {
  const risk = template.riskLevel ?? "medium";
  return safetyDefaultsForRisk(risk, template.tools).startPaused;
}
