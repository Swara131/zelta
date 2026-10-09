import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertWorkflowCanActivate,
  isHighRiskWorkflow,
  WorkflowActivationError,
} from "./activation";
import { snapshotWorkflowVersion } from "./versions";
import { generateWorkflowFromPromptFallback } from "./prompt-heuristics";
import { validateWorkflowGraph } from "./validate-workflow";

describe("workflow activation and versions", () => {
  it("marks send-without-approval as high risk", () => {
    const graph = {
      version: 1,
      nodes: [
        {
          id: "t",
          type: "trigger_manual" as const,
          category: "trigger" as const,
          name: "Manual",
          description: "",
          config: {},
          status: "valid" as const,
          position: 0,
        },
        {
          id: "e",
          type: "tool" as const,
          category: "tool" as const,
          name: "Send",
          description: "",
          config: { toolName: "send_email" },
          status: "idle" as const,
          position: 1,
        },
      ],
      edges: [{ id: "e1", source: "t", target: "e" }],
    };
    assert.equal(isHighRiskWorkflow(graph), true);
    assert.throws(
      () =>
        assertWorkflowCanActivate({
          validation: { valid: true, issues: [] },
          graph,
          safetyReviewedAt: null,
        }),
      WorkflowActivationError
    );
    assert.doesNotThrow(() =>
      assertWorkflowCanActivate({
        validation: { valid: true, issues: [] },
        graph,
        safetyReviewedAt: new Date().toISOString(),
      })
    );
  });

  it("snapshots versions newest first", () => {
    const graph = generateWorkflowFromPromptFallback("Research news and email me");
    const versions = snapshotWorkflowVersion(graph, [], "test");
    assert.equal(versions.length, 1);
    assert.equal(versions[0]?.note, "test");
  });

  it("detects cycles", () => {
    const graph = generateWorkflowFromPromptFallback("Research news");
    const first = graph.nodes[0]!;
    const second = graph.nodes[1]!;
    graph.edges.push({ id: "cycle", source: second.id, target: first.id });
    const result = validateWorkflowGraph(graph, {
      emailConnected: true,
      webSearchConnected: true,
    });
    assert.ok(result.issues.some((issue) => issue.id === "cycle"));
  });
});
