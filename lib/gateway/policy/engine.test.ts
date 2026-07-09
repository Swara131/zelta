import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluatePolicy, aggregatePolicyDecision } from "./engine";
import { getDefaultDemoPolicies } from "./demo-policies";
import type { PolicyRuleDefinition } from "./types";

describe("default demo policies", () => {
  it("allows refund <= 5000 INR (500000 paise)", () => {
    const result = evaluatePolicy({
      toolName: "issue_refund",
      actionType: "financial.refund",
      payload: { amount: 500_000, currency: "INR", customerId: "cus_1" },
    });

    assert.equal(result.decision, "ALLOW");
    assert.ok(
      result.matchedPolicies.some((policy) => policy.policyId === "demo-refund-allow-small")
    );
  });

  it("requires review for refund > 5000 INR", () => {
    const result = evaluatePolicy({
      toolName: "issue_refund",
      actionType: "financial.refund",
      payload: { amount: 500_001, currency: "INR", customerId: "cus_1" },
    });

    assert.equal(result.decision, "REVIEW");
    assert.ok(
      result.matchedPolicies.some((policy) => policy.policyId === "demo-refund-review-large")
    );
  });

  it("blocks delete production database", () => {
    const result = evaluatePolicy({
      toolName: "delete_database",
      actionType: "database.delete",
      payload: {
        environment: "production",
        resourceType: "database",
        destructiveOperation: true,
        productionTarget: true,
      },
    });

    assert.equal(result.decision, "BLOCK");
    assert.ok(
      result.matchedPolicies.some((policy) => policy.policyId === "demo-delete-prod-db-block")
    );
  });

  it("requires review for export > 10000 customer records", () => {
    const result = evaluatePolicy({
      toolName: "export_customers",
      actionType: "data.export",
      payload: { recordCount: 10_001 },
    });

    assert.equal(result.decision, "REVIEW");
    assert.ok(
      result.matchedPolicies.some((policy) => policy.policyId === "demo-export-review-large")
    );
  });

  it("allows read test database", () => {
    const result = evaluatePolicy({
      toolName: "read_database",
      actionType: "database.read",
      payload: {
        environment: "test",
        resourceType: "database",
        destructiveOperation: false,
        productionTarget: false,
      },
    });

    assert.equal(result.decision, "ALLOW");
    assert.ok(
      result.matchedPolicies.some((policy) => policy.policyId === "demo-read-test-allow")
    );
  });
});

describe("decision priority", () => {
  it("BLOCK overrides REVIEW and ALLOW", () => {
    const matches = [
      {
        policyId: "allow-rule",
        name: "Allow rule",
        decision: "ALLOW" as const,
        reason: "allow",
      },
      {
        policyId: "review-rule",
        name: "Review rule",
        decision: "REVIEW" as const,
        reason: "review",
      },
      {
        policyId: "block-rule",
        name: "Block rule",
        decision: "BLOCK" as const,
        reason: "block",
      },
    ];

    assert.equal(aggregatePolicyDecision(matches), "BLOCK");
  });

  it("REVIEW overrides ALLOW when no BLOCK matches", () => {
    const matches = [
      {
        policyId: "allow-rule",
        name: "Allow rule",
        decision: "ALLOW" as const,
        reason: "allow",
      },
      {
        policyId: "review-rule",
        name: "Review rule",
        decision: "REVIEW" as const,
        reason: "review",
      },
    ];

    assert.equal(aggregatePolicyDecision(matches), "REVIEW");
  });

  it("applies BLOCK over ALLOW when multiple demo rules match", () => {
    const hybridRules: PolicyRuleDefinition[] = [
      ...getDefaultDemoPolicies(),
      {
        id: "hybrid-allow-read",
        name: "Hybrid allow read",
        description: "Also matches destructive prod delete payload shape for test",
        priority: 1,
        decision: "ALLOW",
        conditions: {
          toolName: "delete_database",
          actionType: "database.delete",
        },
      },
    ];

    const result = evaluatePolicy({
      toolName: "delete_database",
      actionType: "database.delete",
      payload: {
        environment: "production",
        resourceType: "database",
        destructiveOperation: true,
        productionTarget: true,
      },
      rules: hybridRules,
    });

    assert.equal(result.decision, "BLOCK");
    assert.ok(result.matchedPolicies.some((policy) => policy.decision === "ALLOW"));
    assert.ok(result.matchedPolicies.some((policy) => policy.decision === "BLOCK"));
  });
});
