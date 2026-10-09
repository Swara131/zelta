import type { AgentSpec, ProtectionLevel } from "@/lib/agent-builder/types";
import type { PolicyRuleDefinition } from "@/lib/gateway/policy/types";
import { getDefaultDemoPolicies } from "@/lib/gateway/policy/demo-policies";

export interface PlainEnglishProtectionItem {
  label: string;
}

export interface PlainEnglishProtectionConfig {
  allowed: PlainEnglishProtectionItem[];
  askFirst: PlainEnglishProtectionItem[];
  blocked: PlainEnglishProtectionItem[];
}

export const REFUND_AGENT_PROTECTION: PlainEnglishProtectionConfig = {
  allowed: [
    { label: "Check refund status" },
    { label: "Send customer email" },
    { label: "Refund up to ₹5,000" },
  ],
  askFirst: [
    { label: "Refund above ₹5,000" },
    { label: "Give discount above 20%" },
    { label: "Change customer account information" },
  ],
  blocked: [
    { label: "Delete customer records" },
    { label: "Transfer money without authorization" },
    { label: "Disable security controls" },
  ],
};

function isRefundAgentSpec(spec: AgentSpec): boolean {
  const haystack = [
    spec.name,
    spec.summary,
    spec.purpose,
    ...spec.tools.map((tool) => `${tool.label} ${tool.toolName}`),
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes("refund") || spec.tools.some((tool) => tool.toolName.includes("refund"));
}

function uniqueLabels(items: PlainEnglishProtectionItem[]): PlainEnglishProtectionItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.label.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function groupRulesByLevel(
  rules: AgentSpec["protection"]
): PlainEnglishProtectionConfig {
  const config: PlainEnglishProtectionConfig = {
    allowed: [],
    askFirst: [],
    blocked: [],
  };

  for (const rule of rules) {
    const item = { label: rule.label };
    switch (rule.level as ProtectionLevel) {
      case "allow":
        config.allowed.push(item);
        break;
      case "block":
        config.blocked.push(item);
        break;
      default:
        config.askFirst.push(item);
        break;
    }
  }

  return {
    allowed: uniqueLabels(config.allowed),
    askFirst: uniqueLabels(config.askFirst),
    blocked: uniqueLabels(config.blocked),
  };
}

function mergeProtectionConfigs(
  base: PlainEnglishProtectionConfig,
  overlay: PlainEnglishProtectionConfig
): PlainEnglishProtectionConfig {
  return {
    allowed: uniqueLabels([...base.allowed, ...overlay.allowed]),
    askFirst: uniqueLabels([...base.askFirst, ...overlay.askFirst]),
    blocked: uniqueLabels([...base.blocked, ...overlay.blocked]),
  };
}

/** Build founder-friendly protection copy from a generated agent spec. */
export function protectionFromAgentSpec(spec: AgentSpec): PlainEnglishProtectionConfig {
  const grouped = groupRulesByLevel(spec.protection);

  if (isRefundAgentSpec(spec)) {
    return mergeProtectionConfigs(REFUND_AGENT_PROTECTION, grouped);
  }

  if (
    grouped.allowed.length === 0 &&
    grouped.askFirst.length === 0 &&
    grouped.blocked.length === 0
  ) {
    return REFUND_AGENT_PROTECTION;
  }

  return grouped;
}

/** Default protection view for the Protection page — refund agent example. */
export function getDefaultProtectionConfig(): PlainEnglishProtectionConfig {
  return REFUND_AGENT_PROTECTION;
}

/** Map runtime demo policies to plain English for the advanced panel. */
export function getAdvancedProtectionPolicies(): PolicyRuleDefinition[] {
  return getDefaultDemoPolicies();
}

export const PROTECTION_EXPLANATION =
  "Every important action is checked before it happens.";
