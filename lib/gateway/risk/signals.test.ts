import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeActionHash } from "@/lib/gateway/proposals/canonicalize";
import {
  buildRiskContext,
  extractDeterministicRiskSignals,
  sanitizeRiskContextForClassifier,
} from "./signals";

const ORG_A = "11111111-1111-4111-8111-111111111111";

describe("buildRiskContext", () => {
  it("extracts payment action fields without inventing missing data", () => {
    const context = buildRiskContext({
      agentId: "refund-agent-01",
      toolName: "issue_refund",
      actionType: "financial.refund",
      payload: {
        customerId: "cus_123",
        amount: 500_000,
        currency: "INR",
      },
    });

    assert.equal(context.monetaryAmount.status, "known");
    assert.equal(context.monetaryAmount.status === "known" && context.monetaryAmount.value, 500_000);
    assert.equal(context.currency.status, "known");
    assert.equal(context.currency.status === "known" && context.currency.value, "INR");
    assert.equal(context.reversibility.status, "known");
    assert.equal(
      context.reversibility.status === "known" && context.reversibility.value,
      "reversible"
    );
    assert.equal(context.productionTarget.status, "unknown");
    assert.equal(context.externalDestination.status, "unknown");
  });

  it("extracts destructive database action signals", () => {
    const context = buildRiskContext({
      agentId: "ops-agent",
      toolName: "delete_database",
      actionType: "database.delete",
      payload: {
        resourceType: "database",
        destructiveOperation: true,
        productionTarget: true,
        environment: "production",
      },
    });

    assert.equal(context.destructiveOperation.status, "known");
    assert.equal(
      context.destructiveOperation.status === "known" && context.destructiveOperation.value,
      true
    );
    assert.equal(context.productionTarget.status, "known");
    assert.equal(
      context.productionTarget.status === "known" && context.productionTarget.value,
      true
    );
    assert.equal(context.environment.status, "known");
    assert.equal(
      context.environment.status === "known" && context.environment.value,
      "production"
    );
    assert.equal(context.reversibility.status, "known");
    assert.equal(
      context.reversibility.status === "known" && context.reversibility.value,
      "irreversible"
    );
  });

  it("marks unavailable fields as unknown", () => {
    const context = buildRiskContext({
      agentId: "agent-1",
      toolName: "custom_tool",
      actionType: "custom.action",
      payload: {
        note: "minimal payload",
      },
    });

    assert.equal(context.monetaryAmount.status, "unknown");
    assert.equal(context.currency.status, "unknown");
    assert.equal(context.productionTarget.status, "unknown");
    assert.equal(context.externalDestination.status, "unknown");
    assert.equal(context.newOrUnknownDestination.status, "unknown");
    assert.equal(context.bulkOperation.status, "unknown");
    assert.equal(context.integratorMetadata.status, "unknown");
  });

  it("redacts sensitive integrator metadata values", () => {
    const context = buildRiskContext({
      agentId: "agent-1",
      toolName: "issue_refund",
      actionType: "financial.refund",
      payload: {
        amount: 100,
        currency: "USD",
        riskMetadata: {
          channel: "support",
          apiKey: "al_super_secret_key_value_here",
          executionToken: "et_super_secret_token_value_here",
        },
      },
    });

    assert.equal(context.integratorMetadata.status, "known");
    if (context.integratorMetadata.status === "known") {
      assert.equal(context.integratorMetadata.value.channel, "support");
      assert.equal(context.integratorMetadata.value.apiKey, "[redacted]");
      assert.equal(context.integratorMetadata.value.executionToken, "[redacted]");
    }

    const sanitized = sanitizeRiskContextForClassifier(context);
    const metadata = sanitized.integratorMetadata as { status: string; value: Record<string, unknown> };
    assert.equal(metadata.value.apiKey, "[redacted]");
  });

  it("detects production target from explicit payload", () => {
    const context = buildRiskContext({
      agentId: "agent-1",
      toolName: "read_database",
      actionType: "database.read",
      payload: {
        environment: "test",
        productionTarget: false,
        resourceType: "database",
        destructiveOperation: false,
      },
    });

    assert.equal(context.productionTarget.status, "known");
    assert.equal(
      context.productionTarget.status === "known" && context.productionTarget.value,
      false
    );
  });

  it("detects reversible payment actions from action type", () => {
    const context = buildRiskContext({
      agentId: "agent-1",
      toolName: "issue_refund",
      actionType: "financial.refund",
      payload: {
        amount: 10_000,
        currency: "USD",
      },
    });

    assert.equal(context.reversibility.status, "known");
    assert.equal(
      context.reversibility.status === "known" && context.reversibility.value,
      "reversible"
    );
  });

  it("does not mutate payload or affect action_hash computation", () => {
    const payload = {
      customerId: "cus_123",
      amount: 500_000,
      currency: "INR",
    };
    const payloadBefore = structuredClone(payload);

    const hashBefore = computeActionHash({
      organizationId: ORG_A,
      agentId: "refund-agent-01",
      toolName: "issue_refund",
      actionType: "financial.refund",
      payload,
    });

    buildRiskContext({
      agentId: "refund-agent-01",
      toolName: "issue_refund",
      actionType: "financial.refund",
      payload,
    });
    extractDeterministicRiskSignals(
      buildRiskContext({
        agentId: "refund-agent-01",
        toolName: "issue_refund",
        actionType: "financial.refund",
        payload,
      })
    );

    const hashAfter = computeActionHash({
      organizationId: ORG_A,
      agentId: "refund-agent-01",
      toolName: "issue_refund",
      actionType: "financial.refund",
      payload,
    });

    assert.deepEqual(payload, payloadBefore);
    assert.equal(hashAfter, hashBefore);
  });
});

describe("extractDeterministicRiskSignals", () => {
  it("emits stable signal codes for audit and analytics", () => {
    const context = buildRiskContext({
      agentId: "refund-agent-01",
      toolName: "issue_refund",
      actionType: "financial.refund",
      payload: {
        amount: 600_000,
        currency: "INR",
      },
    });

    const signals = extractDeterministicRiskSignals(context);
    const codes = signals.map((signal) => signal.code);

    assert.ok(codes.includes("agent.identity"));
    assert.ok(codes.includes("action.type.financial.refund"));
    assert.ok(codes.includes("tool.name.issue_refund"));
    assert.ok(codes.includes("financial.amount.present"));
    assert.ok(codes.includes("financial.currency.inr"));
    assert.ok(codes.includes("operation.reversible"));
    assert.ok(signals.every((signal) => signal.source === "deterministic"));
  });

  it("emits unknown codes when facts are unavailable", () => {
    const context = buildRiskContext({
      agentId: "agent-1",
      toolName: "custom_tool",
      actionType: "custom.action",
      payload: {},
    });

    const codes = extractDeterministicRiskSignals(context).map((signal) => signal.code);

    assert.ok(codes.includes("financial.amount.unknown"));
    assert.ok(codes.includes("financial.currency.unknown"));
    assert.ok(codes.includes("environment.production.unknown"));
    assert.ok(codes.includes("destination.external.unknown"));
  });

  it("emits destructive and production signals for blocked DB actions", () => {
    const context = buildRiskContext({
      agentId: "ops-agent",
      toolName: "delete_database",
      actionType: "database.delete",
      payload: {
        resourceType: "database",
        destructiveOperation: true,
        productionTarget: true,
      },
    });

    const codes = extractDeterministicRiskSignals(context).map((signal) => signal.code);

    assert.ok(codes.includes("operation.destructive"));
    assert.ok(codes.includes("environment.production"));
    assert.ok(codes.includes("operation.irreversible"));
    assert.ok(codes.includes("resource.type.database"));
  });
});
