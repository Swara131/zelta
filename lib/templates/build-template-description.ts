import type { AgentTemplate, TemplateCustomizations } from "./types";

function formatInr(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

function applyThreshold(description: string, threshold: number): string {
  const formatted = formatInr(threshold);

  if (/₹[\d,]+/.test(description)) {
    return description.replace(/₹[\d,]+/g, formatted);
  }

  return `${description} under ${formatted}`;
}

export function buildTemplateAgentDescription(
  template: AgentTemplate,
  customizations: TemplateCustomizations
): string {
  let description = template.defaultDescription.trim();

  if (template.supportsThreshold && customizations.threshold != null) {
    description = applyThreshold(description, customizations.threshold);
  }

  if (customizations.needsApproval) {
    description = `${description}. Require human approval before executing actions.`;
  }

  const instructions = customizations.customInstructions?.trim();
  if (instructions) {
    const suffix = instructions.endsWith(".") ? instructions : `${instructions}.`;
    description = `${description} ${suffix}`;
  }

  return description.trim();
}

export function resolveTemplateThreshold(
  template: AgentTemplate,
  customizations: TemplateCustomizations
): number {
  if (template.supportsThreshold && customizations.threshold != null) {
    return customizations.threshold;
  }
  return template.defaultThreshold ?? 5000;
}
