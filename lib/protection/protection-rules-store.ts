import { getDefaultProtectionConfig } from "@/lib/protection/plain-english";

export type ProtectionSection = "allowed" | "askFirst" | "blocked";

export interface EditableProtectionRule {
  id: string;
  label: string;
}

export interface EditableProtectionConfig {
  allowed: EditableProtectionRule[];
  askFirst: EditableProtectionRule[];
  blocked: EditableProtectionRule[];
}

const STORAGE_KEY = "zelta-protection-rules";

function createRule(label: string, prefix: string, index: number): EditableProtectionRule {
  return {
    id: `${prefix}-${index}-${label.toLowerCase().replace(/\s+/g, "-").slice(0, 24)}`,
    label,
  };
}

export function getDefaultEditableProtectionConfig(): EditableProtectionConfig {
  const defaults = getDefaultProtectionConfig();

  return {
    allowed: defaults.allowed.map((item, index) => createRule(item.label, "allow", index)),
    askFirst: defaults.askFirst.map((item, index) => createRule(item.label, "review", index)),
    blocked: defaults.blocked.map((item, index) => createRule(item.label, "block", index)),
  };
}

export function loadProtectionRules(): EditableProtectionConfig {
  if (typeof window === "undefined") {
    return getDefaultEditableProtectionConfig();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return getDefaultEditableProtectionConfig();
    }

    const parsed = JSON.parse(raw) as EditableProtectionConfig;
    if (
      !Array.isArray(parsed.allowed) ||
      !Array.isArray(parsed.askFirst) ||
      !Array.isArray(parsed.blocked)
    ) {
      return getDefaultEditableProtectionConfig();
    }

    return parsed;
  } catch {
    return getDefaultEditableProtectionConfig();
  }
}

export function saveProtectionRules(config: EditableProtectionConfig): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function createProtectionRuleId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
