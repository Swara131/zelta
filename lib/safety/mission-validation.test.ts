import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { LoadedAgent } from "@/lib/agents/runtime/types";
import { evaluateActionPure } from "./gate";
import {
  hasExplicitMissionLock,
  resolveAgentMission,
} from "./mission";
import { validateMissionAction } from "./mission-validation";

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
      description: "Research and summarize information",
      goal: "Research and summarize information",
      instructions: null,
      model: null,
      source: "builder",
      tools: ["web_search", "send_email"],
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

describe("validateMissionAction", () => {
  it("allows action inside explicit mission scope", () => {
    const agent = buildAgent({
      safetySettings: {
        mission: {
          goal: "Find and summarize news",
          allowedTools: ["web_search"],
          allowedActions: ["research.web_search"],
          restrictions: ["no_payments", "no_file_deletion"],
        },
      },
    });

    const result = validateMissionAction({
      agent,
      tool: "web_search",
      action: "research.web_search",
      parameters: { query: "latest updates" },
    });

    assert.equal(result.allowed, true);
    assert.equal(hasExplicitMissionLock(agent), true);
  });

  it("blocks unauthorized tool outside mission", () => {
    const agent = buildAgent({
      safetySettings: {
        mission: {
          goal: "Find and summarize news",
          allowedTools: ["web_search"],
          allowedActions: ["research.web_search"],
        },
      },
    });

    const result = validateMissionAction({
      agent,
      tool: "send_email",
      action: "communication.email",
      parameters: { to: "user@example.com", subject: "Hi", body: "Summary" },
    });

    assert.equal(result.allowed, false);
    assert.equal(result.violatedRule, "mission.allowed_tools");
    assert.match(result.reason, /outside the agent's configured mission/i);
  });

  it("blocks action outside allowed action types", () => {
    const agent = buildAgent({
      safetySettings: {
        mission: {
          allowedTools: ["send_email", "web_search"],
          allowedActions: ["research.web_search"],
        },
      },
    });

    const result = validateMissionAction({
      agent,
      tool: "send_email",
      action: "communication.email",
      parameters: { to: "user@example.com", subject: "Hi", body: "Summary" },
    });

    assert.equal(result.allowed, false);
    assert.equal(result.violatedRule, "mission.allowed_actions");
  });

  it("blocks payment tools when no_payments restriction is set", () => {
    const agent = buildAgent({
      safetySettings: {
        mission: {
          allowedTools: ["issue_refund", "web_search"],
          restrictions: ["no_payments"],
        },
      },
    });

    const result = validateMissionAction({
      agent,
      tool: "issue_refund",
      action: "financial.refund",
      parameters: { amount: 100, currency: "INR" },
    });

    assert.equal(result.allowed, false);
    assert.equal(result.violatedRule, "mission.restriction.no_payments");
  });

  it("passes through agents without explicit mission lock", () => {
    const agent = buildAgent({ safetySettings: {} });

    assert.equal(hasExplicitMissionLock(agent), false);

    const result = validateMissionAction({
      agent,
      tool: "send_email",
      action: "communication.email",
      parameters: { to: "user@example.com", subject: "Hi", body: "Test" },
    });

    assert.equal(result.allowed, true);
  });

  it("resolves allowed tools from capabilities", () => {
    const agent = buildAgent({
      safetySettings: {
        mission: {
          goal: "Research and email summaries",
          allowedCapabilities: ["web_search", "send_email"],
        },
      },
    });

    const mission = resolveAgentMission(agent);
    assert.ok(mission.allowedTools.includes("web_search"));
    assert.ok(mission.allowedTools.includes("send_email"));
    assert.equal(mission.lockEnabled, true);
  });

  it("enforces resource restrictions", () => {
    const agent = buildAgent({
      safetySettings: {
        mission: {
          allowedTools: ["http_request"],
          resourceRestrictions: {
            blockedResourceTypes: ["database"],
          },
        },
      },
    });

    const result = validateMissionAction({
      agent,
      tool: "http_request",
      action: "integration.http",
      parameters: {
        url: "https://api.example.com",
        method: "GET",
        resourceType: "database",
      },
    });

    assert.equal(result.allowed, false);
    assert.equal(result.violatedRule, "mission.resource.blocked_type");
  });
});

describe("evaluateActionPure mission lock integration", () => {
  it("blocks tool execution when mission lock rejects action", () => {
    const result = evaluateActionPure({
      agent: buildAgent({
        safetySettings: {
          mission: {
            allowedTools: ["web_search"],
          },
        },
      }),
      tool: "send_email",
      action: "communication.email",
      parameters: { to: "a@b.com", subject: "x", body: "y" },
    });

    assert.equal(result.decision, "BLOCK");
    assert.equal(result.canExecute, false);
    assert.match(result.reason, /outside the agent's configured mission/i);
  });

  it("allows legacy agents without mission lock to reach policy layer", () => {
    const result = evaluateActionPure({
      agent: buildAgent(),
      tool: "web_search",
      action: "research.web_search",
      parameters: { query: "news" },
    });

    assert.equal(result.decision, "ALLOW");
    assert.equal(result.mission.lockEnabled, false);
  });
});
