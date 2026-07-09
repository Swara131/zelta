import type { PolicyRuleDefinition } from "./types";

/**
 * Built-in deterministic demo policies.
 * Amounts for INR refunds use paise (5000 INR = 500000).
 */
export const DEFAULT_DEMO_POLICIES: PolicyRuleDefinition[] = [
  {
    id: "demo-refund-allow-small",
    name: "Small INR refund auto-allow",
    description: "Refunds up to 5000 INR are automatically allowed.",
    priority: 10,
    decision: "ALLOW",
    conditions: {
      toolName: "issue_refund",
      actionType: "financial.refund",
      currency: "INR",
      amountMax: 500_000,
    },
  },
  {
    id: "demo-refund-review-large",
    name: "Large INR refund requires review",
    description: "Refunds above 5000 INR require human review.",
    priority: 20,
    decision: "REVIEW",
    conditions: {
      toolName: "issue_refund",
      actionType: "financial.refund",
      currency: "INR",
      amountMin: 500_001,
    },
  },
  {
    id: "demo-delete-prod-db-block",
    name: "Block production database deletion",
    description: "Destructive production database operations are blocked.",
    priority: 5,
    decision: "BLOCK",
    conditions: {
      toolName: "delete_database",
      actionType: "database.delete",
      resourceType: "database",
      destructiveOperation: true,
      productionTarget: true,
    },
  },
  {
    id: "demo-export-review-large",
    name: "Large customer export requires review",
    description: "Exporting more than 10000 customer records requires review.",
    priority: 30,
    decision: "REVIEW",
    conditions: {
      toolName: "export_customers",
      actionType: "data.export",
      dataExportSizeMin: 10_001,
    },
  },
  {
    id: "demo-read-test-allow",
    name: "Allow test database reads",
    description: "Read-only access to test databases is allowed.",
    priority: 40,
    decision: "ALLOW",
    conditions: {
      toolName: "read_database",
      actionType: "database.read",
      environment: "test",
      resourceType: "database",
      destructiveOperation: false,
      productionTarget: false,
    },
  },
];

export function getDefaultDemoPolicies(): PolicyRuleDefinition[] {
  return DEFAULT_DEMO_POLICIES.map((policy) => ({
    ...policy,
    conditions: { ...policy.conditions },
  }));
}
