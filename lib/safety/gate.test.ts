import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { LoadedAgent } from "@/lib/agents/runtime/types";
import {
  defaultSafetyDecisionForUnknownAction,
  evaluateActionPure,
} from "./gate";

function buildAgent(overrides: Partial<LoadedAgent["record"]> = {}): LoadedAgent {
  return {
    gatewayAgentId: "test-agent",
    enabledTools: ["web_search", "send_email", "issue_refund"],
    systemPrompt: "test",
    record: {
      id: "00000000-0000-4000-8000-000000000001",
      userId: "user-1",
      organizationId: "org-1",
      name: "Test Agent",
      slug: "test-agent",
      description: "Test agent",
      goal: "Help with research and communication",
      instructions: null,
      model: null,
      source: "builder",
      tools: ["web_search", "send_email", "issue_refund"],
      capabilities: [],
      triggerType: "schedule",
      schedule: {},
      timezone: "Asia/Kolkata",
      memoryEnabled: false,
      safetySettings: {},
      suggestedThreshold: 5000,
      status: "active",
      publishedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides,
    },
  };
}

describe("evaluateActionPure", () => {
  it("A. allows read-only actions when policies match ALLOW", () => {
    const result = evaluateActionPure({
      agent: buildAgent(),
      tool: "web_search",
      action: "research.web_search",
      parameters: { query: "latest AI news" },
    });

    assert.equal(result.decision, "ALLOW");
    assert.equal(result.canExecute, true);
  });

  it("B. blocks destructive production actions", () => {
    const result = evaluateActionPure({
      agent: buildAgent(),
      tool: "http_request",
      action: "integration.http",
      parameters: {
        url: "https://api.example.com/db",
        method: "DELETE",
        environment: "production",
        resourceType: "database",
        destructiveOperation: true,
      },
    });

    assert.equal(result.decision, "BLOCK");
    assert.equal(result.canExecute, false);
  });

  it("C. requires approval for actions flagged by agent settings", () => {
    const result = evaluateActionPure({
      agent: buildAgent({
        safetySettings: {
          requireApprovalFor: ["send_email"],
        },
      }),
      tool: "send_email",
      action: "communication.email",
      parameters: {
        to: "one@example.com",
        subject: "Hello",
        body: "Test",
      },
    });

    assert.equal(result.decision, "REQUIRE_APPROVAL");
    assert.equal(result.canExecute, false);
  });

  it("D. uses safe default for unknown/unmatched non-read-only actions", () => {
    assert.equal(
      defaultSafetyDecisionForUnknownAction({
        tool: "http_request",
        missionAllowedTools: ["http_request"],
      }),
      "REQUIRE_APPROVAL"
    );

    assert.equal(
      defaultSafetyDecisionForUnknownAction({
        tool: "web_search",
        missionAllowedTools: ["web_search"],
      }),
      "ALLOW"
    );
  });

  it("blocks tools outside mission allowedTools when mission lock is explicit", () => {
    const result = evaluateActionPure({
      agent: buildAgent({
        safetySettings: {
          mission: {
            goal: "Research only",
            allowedTools: ["web_search"],
            allowedActions: ["research.web_search"],
          },
        },
      }),
      tool: "send_email",
      action: "communication.email",
      parameters: { to: "a@b.com", subject: "x", body: "y" },
    });

    assert.equal(result.decision, "BLOCK");
    assert.equal(result.policyId, "mission.allowed_tools");
    assert.match(result.reason, /outside the agent's configured mission/i);
  });

  it("redacts sensitive parameter keys from audit payload", () => {
    const result = evaluateActionPure({
      agent: buildAgent(),
      tool: "web_search",
      action: "research.web_search",
      parameters: {
        query: "news",
        api_key: "secret-value",
        token: "et_abc123def456ghi789",
      },
    });

    assert.equal(result.sanitizedParameters.api_key, "[redacted]");
    assert.equal(result.sanitizedParameters.token, "[redacted]");
    assert.equal(result.sanitizedParameters.query, "news");
  });
});
