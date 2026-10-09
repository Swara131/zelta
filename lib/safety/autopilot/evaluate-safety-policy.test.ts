import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateSafetyPolicy, buildPolicySummary } from "./evaluate-safety-policy";
import type {
  AgentApprovalRuleRecord,
  AgentExecutionLimitRecord,
  AgentSafetyPolicyRecord,
  AgentToolPermissionRecord,
} from "./types";
import { DEFAULT_DATA_PROTECTION } from "./presets";

const basePolicy: AgentSafetyPolicyRecord = {
  id: "p1",
  agentId: "a1",
  organizationId: "o1",
  protectionMode: "balanced",
  dataProtection: { ...DEFAULT_DATA_PROTECTION },
  lastCheckedAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const baseLimits: AgentExecutionLimitRecord = {
  id: "l1",
  agentId: "a1",
  organizationId: "o1",
  maxCostPerRunUsd: 2,
  dailySpendingCapUsd: 25,
  maxToolCallsPerRun: 40,
  maxExecutionTimeSeconds: 300,
  maxRetries: 2,
  maxMessagesPerRun: 20,
};

const baseRules: AgentApprovalRuleRecord[] = [
  {
    id: "r1",
    agentId: "a1",
    organizationId: "o1",
    ruleKey: "send_message",
    enabled: true,
    thresholdValue: 20,
    thresholdUnit: "recipients",
  },
  {
    id: "r2",
    agentId: "a1",
    organizationId: "o1",
    ruleKey: "process_payments",
    enabled: true,
    thresholdValue: 500,
    thresholdUnit: "usd",
  },
];

describe("evaluateSafetyPolicy", () => {
  it("returns high score for safe balanced defaults", () => {
    const permissions: AgentToolPermissionRecord[] = [
      {
        id: "t1",
        agentId: "a1",
        organizationId: "o1",
        toolId: "gmail",
        toolLabel: "Gmail",
        permissionLevel: "ask_approval",
        isHighRisk: true,
        revokedAt: null,
      },
    ];

    const result = evaluateSafetyPolicy({
      policy: basePolicy,
      permissions,
      approvalRules: baseRules,
      limits: baseLimits,
    });

    assert.ok(result.score >= 70);
    assert.ok(result.score <= 100);
    assert.equal(result.status, "protected");
  });

  it("deducts for automatic stripe permissions and disabled protections", () => {
    const result = evaluateSafetyPolicy({
      policy: {
        ...basePolicy,
        protectionMode: "autonomous",
        dataProtection: {
          ...DEFAULT_DATA_PROTECTION,
          promptInjectionDefense: false,
        },
      },
      permissions: [
        {
          id: "t1",
          agentId: "a1",
          organizationId: "o1",
          toolId: "stripe",
          toolLabel: "Stripe",
          permissionLevel: "automatic",
          isHighRisk: true,
          revokedAt: null,
        },
      ],
      approvalRules: baseRules.map((r) => ({ ...r, enabled: false })),
      limits: {
        ...baseLimits,
        dailySpendingCapUsd: null,
        maxCostPerRunUsd: null,
      },
    });

    assert.ok(result.score < 75);
    assert.notEqual(result.status, "protected");
    assert.ok(result.recommendations.length > 0);
  });

  it("clamps score between 0 and 100", () => {
    const result = evaluateSafetyPolicy({
      policy: {
        ...basePolicy,
        protectionMode: "autonomous",
        dataProtection: {
          promptInjectionDefense: false,
          secretDetection: false,
          piiDetection: false,
          blockPromptExtraction: false,
          restrictSensitiveKb: false,
        },
      },
      permissions: [
        {
          id: "t1",
          agentId: "a1",
          organizationId: "o1",
          toolId: "stripe",
          toolLabel: "Stripe",
          permissionLevel: "automatic",
          isHighRisk: true,
          revokedAt: null,
        },
        {
          id: "t2",
          agentId: "a1",
          organizationId: "o1",
          toolId: "database",
          toolLabel: "Database",
          permissionLevel: "automatic",
          isHighRisk: true,
          revokedAt: null,
        },
      ],
      approvalRules: [],
      limits: {
        ...baseLimits,
        dailySpendingCapUsd: null,
        maxCostPerRunUsd: null,
        maxToolCallsPerRun: null,
      },
    });

    assert.ok(result.score >= 0);
    assert.ok(result.score <= 100);
  });
});

describe("buildPolicySummary", () => {
  it("generates readable approval summaries", () => {
    const lines = buildPolicySummary(baseRules, baseLimits);
    assert.ok(lines.some((l) => l.includes("20 recipients")));
    assert.ok(lines.some((l) => l.includes("$500")));
  });
});
