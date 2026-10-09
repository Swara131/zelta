import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateWorkflowFromInterpretation } from "./generate-from-interpretation";
import { syncWorkflowToAgentConfig } from "./sync-to-agent";
import type { AgentInterpretation } from "@/lib/agents/builder-types";
import { validateWorkflowGraph } from "./validate-workflow";

const sampleInterpretation: AgentInterpretation = {
  displayName: "AI News Agent",
  goal: "Find the latest AI news every morning and email a summary",
  instructions: "Search for AI news, summarize top 5 stories, send email.",
  scheduleSummary: "Every morning at 9:00 AM",
  schedule: { when: "daily", time: "09:00", triggerType: "schedule" },
  timezone: "Asia/Kolkata",
  capabilityIds: ["web_search", "email"],
  capabilities: [
    { id: "web_search", label: "Web search", enabled: true },
    { id: "email", label: "Email", enabled: true },
  ],
  tools: ["web_search", "send_email"],
  protectionSummary: "Wave checks important actions",
  triggerType: "schedule",
  suggestedThreshold: 5000,
  originalDescription: "Find AI news every morning and email me",
  deliveryMode: "email",
};

describe("workflow generation and sync", () => {
  it("generates workflow nodes from interpretation", () => {
    const graph = generateWorkflowFromInterpretation(sampleInterpretation);
    assert.ok(graph.nodes.length >= 4);
    assert.equal(graph.nodes[0]?.category, "trigger");
    assert.ok(graph.nodes.some((node) => node.config.toolName === "web_search"));
    assert.ok(graph.nodes.some((node) => node.type === "safety_gate"));
  });

  it("syncs workflow edits back to agent configuration", () => {
    const graph = generateWorkflowFromInterpretation(sampleInterpretation);
    const config = syncWorkflowToAgentConfig(graph, {
      displayName: sampleInterpretation.displayName,
      suggestedThreshold: 5000,
    });

    assert.ok(config.tools.includes("web_search"));
    assert.equal(config.triggerType, "schedule");
    assert.equal(config.deliveryMode, "email");
    assert.match(config.instructions, /Workflow steps/i);
  });

  it("flags missing trigger as invalid", () => {
    const graph = generateWorkflowFromInterpretation(sampleInterpretation);
    const withoutTrigger = {
      ...graph,
      nodes: graph.nodes.filter((node) => node.category !== "trigger"),
    };
    const result = validateWorkflowGraph(withoutTrigger, {
      emailConnected: true,
      webSearchConnected: true,
    });
    assert.equal(result.valid, false);
  });

  it("generates a lead-outreach workflow from keywords", () => {
    const interpretation: AgentInterpretation = {
      ...sampleInterpretation,
      goal: "Qualify sales leads and send outreach after approval",
      originalDescription:
        "Create an agent that receives sales leads, researches them, scores them, drafts outreach emails, and sends only after I approve.",
      tools: ["web_search", "send_email"],
    };
    const graph = generateWorkflowFromInterpretation(interpretation);
    assert.ok(graph.nodes.some((node) => node.type === "ai_score"));
    assert.ok(graph.nodes.some((node) => node.type === "safety_approval"));
    assert.ok(graph.nodes.some((node) => node.config.toolName === "send_email"));
  });

  it("rejects unbounded loops and high-risk activation", () => {
    const graph = generateWorkflowFromInterpretation(sampleInterpretation);
    graph.nodes.push({
      id: "loop-1",
      type: "loop",
      category: "logic",
      name: "Loop",
      description: "Repeat",
      config: {},
      status: "idle",
      position: graph.nodes.length,
    });
    const result = validateWorkflowGraph(graph, {
      emailConnected: true,
      webSearchConnected: true,
    });
    assert.ok(result.issues.some((issue) => issue.id.startsWith("loop-bound")));
  });
});
