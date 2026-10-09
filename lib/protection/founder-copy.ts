import type { PolicyDecisionOutcome, PolicyRuleDefinition } from "@/lib/gateway/policy/types";
import { getDefaultDemoPolicies } from "@/lib/gateway/policy/demo-policies";

export interface ProtectionDecisionCard {
  decision: PolicyDecisionOutcome;
  title: string;
  description: string;
  example: string;
}

export interface FounderProtectionRule {
  id: string;
  name: string;
  whenItApplies: string;
  decision: PolicyDecisionOutcome;
  decisionLabel: string;
  agentsLabel: string;
  status: "Active";
}

export interface QuickProtectionSetting {
  id: string;
  label: string;
  description: string;
  active: boolean;
}

const RULE_DISPLAY_NAMES: Record<string, string> = {
  "demo-refund-allow-small": "Small Refund Auto-Allow",
  "demo-refund-review-large": "Large Refund Protection",
  "demo-delete-prod-db-block": "Production Database Protection",
  "demo-export-review-large": "Large Data Export Protection",
  "demo-read-test-allow": "Test Database Read Access",
};

function formatInrFromPaise(paise: number): string {
  const rupees = paise / 100;
  const rounded =
    Number.isInteger(rupees) || Math.abs(rupees - Math.round(rupees)) < 0.02
      ? Math.round(rupees)
      : rupees;
  return `₹${rounded.toLocaleString("en-IN")}`;
}

function policyToWhenApplies(policy: PolicyRuleDefinition): string {
  const { conditions } = policy;

  if (conditions.amountMin != null && conditions.currency === "INR") {
    const threshold = Math.floor(conditions.amountMin / 100);
    return `When refund amount is above ${formatInrFromPaise(threshold * 100)}`;
  }

  if (conditions.amountMax != null && conditions.currency === "INR") {
    return `When refund amount is up to ${formatInrFromPaise(conditions.amountMax)}`;
  }

  if (conditions.destructiveOperation && conditions.productionTarget) {
    return "When deleting production data";
  }

  if (conditions.dataExportSizeMin != null) {
    return `When exporting more than ${conditions.dataExportSizeMin.toLocaleString("en-IN")} customer records`;
  }

  if (conditions.environment === "test" && conditions.destructiveOperation === false) {
    return "When reading a test database (non-destructive)";
  }

  return policy.description;
}

export function formatProtectionDecision(decision: PolicyDecisionOutcome): string {
  switch (decision) {
    case "ALLOW":
      return "Allow automatically";
    case "REVIEW":
      return "Require approval";
    case "BLOCK":
      return "Always block";
  }
}

export function getHowProtectionWorksCards(): ProtectionDecisionCard[] {
  return [
    {
      decision: "ALLOW",
      title: "Allow",
      description: "Safe actions can happen automatically.",
      example: "Send an order-status email",
    },
    {
      decision: "REVIEW",
      title: "Review",
      description: "Sensitive actions wait for a human decision.",
      example: "Refund ₹50,000",
    },
    {
      decision: "BLOCK",
      title: "Block",
      description: "Dangerous or unauthorized actions are stopped.",
      example: "Delete production data",
    },
  ];
}

export function policyToFounderRule(policy: PolicyRuleDefinition): FounderProtectionRule {
  return {
    id: policy.id,
    name: RULE_DISPLAY_NAMES[policy.id] ?? policy.name,
    whenItApplies: policyToWhenApplies(policy),
    decision: policy.decision,
    decisionLabel: formatProtectionDecision(policy.decision),
    agentsLabel: "All connected agents",
    status: "Active",
  };
}

export function getFounderProtectionRules(): FounderProtectionRule[] {
  return getDefaultDemoPolicies()
    .slice()
    .sort((a, b) => a.priority - b.priority)
    .map(policyToFounderRule);
}

/** Read-only quick settings derived from built-in demo policies (no fake toggles). */
export function getQuickProtectionSettings(
  policies: PolicyRuleDefinition[] = getDefaultDemoPolicies()
): QuickProtectionSetting[] {
  const ids = new Set(policies.map((policy) => policy.id));

  return [
    {
      id: "high-value-approval",
      label: "Require approval for high-value actions",
      description: "Large refunds and big data exports wait for your decision.",
      active: ids.has("demo-refund-review-large") || ids.has("demo-export-review-large"),
    },
    {
      id: "block-destructive",
      label: "Block destructive actions",
      description: "Dangerous operations like deleting production data are stopped.",
      active: ids.has("demo-delete-prod-db-block"),
    },
    {
      id: "allow-low-risk",
      label: "Allow low-risk actions automatically",
      description: "Small refunds and safe reads can proceed without asking you.",
      active: ids.has("demo-refund-allow-small") || ids.has("demo-read-test-allow"),
    },
    {
      id: "protect-sensitive-data",
      label: "Protect sensitive data",
      description: "Large exports and high-impact actions are guarded.",
      active: ids.has("demo-export-review-large") || ids.has("demo-refund-review-large"),
    },
  ];
}

/** Refund threshold from demo policies — used in the walkthrough example. */
export function getLargeRefundThresholdLabel(): string {
  const policy = getDefaultDemoPolicies().find((p) => p.id === "demo-refund-allow-small");
  if (policy?.conditions.amountMax != null) {
    return formatInrFromPaise(policy.conditions.amountMax);
  }
  return "₹5,000";
}
