import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateDecision } from "./evaluate-decision";
import type { DecisionAgentConfig } from "./types";

const baseConfig: DecisionAgentConfig = {
  decisionQuestion: "Approve refund?",
  inputs: ["refund_amount", "customer_eligible", "risk_score"],
  rules: [
    {
      id: "allow-small",
      label: "Small eligible refund",
      expression: "refund_amount <= threshold AND customer_eligible AND risk_score < 0.5",
      outcome: "allow",
    },
    {
      id: "review-large",
      label: "Large refund",
      expression: "otherwise",
      outcome: "review",
    },
  ],
  actions: ["process_refund", "notify_customer"],
  approvalWhen: "High amount or elevated risk",
  workflow: [],
  aiReasoningEnabled: false,
};

describe("evaluateDecision", () => {
  it("allows small eligible low-risk refunds", () => {
    const result = evaluateDecision(baseConfig, {
      refund_amount: 2000,
      customer_eligible: true,
      risk_score: 0.2,
    });
    assert.equal(result.outcome, "allow");
    assert.equal(result.matchedRuleId, "allow-small");
  });

  it("routes large refunds to review", () => {
    const result = evaluateDecision(baseConfig, {
      refund_amount: 75000,
      customer_eligible: true,
      risk_score: 0.8,
    });
    assert.equal(result.outcome, "review");
  });
});
