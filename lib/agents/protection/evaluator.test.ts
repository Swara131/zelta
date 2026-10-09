import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateZeltaProtection } from "./evaluator";
import type { LoadedAgent } from "../runtime/types";

function mockAgent(overrides: Partial<LoadedAgent["record"]> = {}): LoadedAgent {
  return {
    gatewayAgentId: "demo-agent",
    enabledTools: ["send_email"],
    systemPrompt: "test",
    record: {
      id: "00000000-0000-4000-8000-000000000001",
      userId: "user",
      organizationId: "org",
      name: "Demo Agent",
      slug: "demo-agent",
      description: "Demo",
      goal: "Demo",
      instructions: null,
      model: null,
      source: "test",
      tools: ["send_email"],
      capabilities: [],
      triggerType: "schedule",
      schedule: {},
      timezone: "UTC",
      memoryEnabled: false,
      safetySettings: {},
      suggestedThreshold: 5000,
      status: "published",
      publishedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides,
    },
  };
}

describe("evaluateZeltaProtection", () => {
  it("allows a normal single-recipient email", () => {
    const result = evaluateZeltaProtection({
      agent: mockAgent(),
      toolName: "send_email",
      actionType: "communication.email",
      payload: {
        to: "customer@example.com",
        subject: "Hello",
        message: "Thanks for your order",
      },
    });

    assert.equal(result.decision, "ALLOW");
    assert.equal(result.riskLevel, "low");
  });

  it("requires review for bulk email", () => {
    const result = evaluateZeltaProtection({
      agent: mockAgent(),
      toolName: "send_email",
      actionType: "communication.email",
      payload: {
        recipients: Array.from({ length: 500 }, (_, index) => `user${index}@example.com`),
        subject: "Announcement",
        message: "Big update",
      },
    });

    assert.equal(result.decision, "REVIEW");
    assert.match(result.reason, /bulk|approval|review/i);
  });

  it("blocks destructive production actions", () => {
    const result = evaluateZeltaProtection({
      agent: mockAgent({ tools: ["query_supabase"] }),
      toolName: "query_supabase",
      actionType: "data.query",
      payload: {
        table: "agents",
        destructiveOperation: true,
        productionTarget: true,
      },
    });

    assert.equal(result.decision, "BLOCK");
  });

  it("requires review for WhatsApp messages", () => {
    const result = evaluateZeltaProtection({
      agent: mockAgent({ tools: ["send_whatsapp_message"] }),
      toolName: "send_whatsapp_message",
      actionType: "communication.whatsapp",
      payload: { to: "+15551212", message: "Hello" },
    });

    assert.equal(result.decision, "REVIEW");
  });

  it("requires review for CRM deletes instead of executing them", () => {
    const result = evaluateZeltaProtection({
      agent: mockAgent({ tools: ["delete_crm_record"] }),
      toolName: "delete_crm_record",
      actionType: "crm.delete",
      payload: { customerId: "cus_12345" },
    });

    assert.equal(result.decision, "REVIEW");
  });

  it("requires review for refunds of any amount", () => {
    const result = evaluateZeltaProtection({
      agent: mockAgent({ tools: ["issue_refund"] }),
      toolName: "issue_refund",
      actionType: "financial.refund",
      payload: { customerId: "cus_123", amount: 500, currency: "INR" },
    });

    assert.equal(result.decision, "REVIEW");
  });

  it("allows read-only research tools", () => {
    const result = evaluateZeltaProtection({
      agent: mockAgent({ tools: ["web_search"] }),
      toolName: "web_search",
      actionType: "research.web_search",
      payload: { query: "latest product news" },
    });

    assert.equal(result.decision, "ALLOW");
  });
});
