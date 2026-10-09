export type StructuredProtectionDecision = "ALLOW" | "REVIEW" | "BLOCK";

export interface StructuredProtectionRule {
  id: string;
  action: string;
  condition: string;
  explanation: string;
  decision: StructuredProtectionDecision;
}

export interface StructuredProtectionConfig {
  rules: StructuredProtectionRule[];
}

const STORAGE_KEY = "zelta-protection-structured-rules";

export const DEFAULT_STRUCTURED_PROTECTION_RULES: StructuredProtectionRule[] = [
  {
    id: "rule-refund-allow",
    action: "Refund customer",
    condition: "Up to ₹5,000",
    explanation: "Small refunds can proceed without asking you first.",
    decision: "ALLOW",
  },
  {
    id: "rule-refund-review",
    action: "Refund customer",
    condition: "Above ₹5,000",
    explanation: "Large refunds need your approval before money moves.",
    decision: "REVIEW",
  },
  {
    id: "rule-email-allow",
    action: "Send customer email",
    condition: "Any message",
    explanation: "Routine customer emails can go out automatically.",
    decision: "ALLOW",
  },
  {
    id: "rule-status-allow",
    action: "Check refund status",
    condition: "Read-only lookup",
    explanation: "Looking up status does not change anything.",
    decision: "ALLOW",
  },
  {
    id: "rule-discount-review",
    action: "Give discount",
    condition: "Above 20%",
    explanation: "Big discounts need a human check before they apply.",
    decision: "REVIEW",
  },
  {
    id: "rule-account-review",
    action: "Change customer account",
    condition: "Any change",
    explanation: "Account changes can affect access, billing, and security.",
    decision: "REVIEW",
  },
  {
    id: "rule-transfer-review",
    action: "Transfer money",
    condition: "Any amount",
    explanation: "Moving funds always needs your sign-off.",
    decision: "REVIEW",
  },
  {
    id: "rule-delete-block",
    action: "Delete customer record",
    condition: "Any amount",
    explanation: "Deleting customer data is never allowed.",
    decision: "BLOCK",
  },
  {
    id: "rule-security-block",
    action: "Disable security controls",
    condition: "Any attempt",
    explanation: "Security settings must stay enabled at all times.",
    decision: "BLOCK",
  },
];

export function formatStructuredDecision(decision: StructuredProtectionDecision): string {
  switch (decision) {
    case "ALLOW":
      return "ALLOW";
    case "REVIEW":
      return "APPROVAL";
    case "BLOCK":
      return "BLOCK";
  }
}

export function formatStructuredDecisionLong(decision: StructuredProtectionDecision): string {
  switch (decision) {
    case "ALLOW":
      return "Allowed automatically";
    case "REVIEW":
      return "Approval required";
    case "BLOCK":
      return "Blocked";
  }
}

export function structuredDecisionClass(decision: StructuredProtectionDecision): string {
  switch (decision) {
    case "ALLOW":
      return "prot-rule-decision-allow";
    case "REVIEW":
      return "prot-rule-decision-review";
    case "BLOCK":
      return "prot-rule-decision-block";
  }
}

export function getDefaultStructuredProtectionConfig(): StructuredProtectionConfig {
  return {
    rules: DEFAULT_STRUCTURED_PROTECTION_RULES.map((rule) => ({ ...rule })),
  };
}

export function loadStructuredProtectionRules(): StructuredProtectionConfig {
  if (typeof window === "undefined") {
    return getDefaultStructuredProtectionConfig();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return getDefaultStructuredProtectionConfig();
    }

    const parsed = JSON.parse(raw) as StructuredProtectionConfig;
    if (!Array.isArray(parsed.rules)) {
      return getDefaultStructuredProtectionConfig();
    }

    const rules = parsed.rules.filter(
      (rule): rule is StructuredProtectionRule =>
        typeof rule?.id === "string" &&
        typeof rule?.action === "string" &&
        typeof rule?.condition === "string" &&
        typeof rule?.explanation === "string" &&
        (rule.decision === "ALLOW" || rule.decision === "REVIEW" || rule.decision === "BLOCK")
    );

    if (rules.length === 0) {
      return getDefaultStructuredProtectionConfig();
    }

    return { rules };
  } catch {
    return getDefaultStructuredProtectionConfig();
  }
}

export function saveStructuredProtectionRules(config: StructuredProtectionConfig): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function createStructuredRuleId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
