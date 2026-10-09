"use client";

import { Bot, GitBranch, Shield, Zap } from "lucide-react";
import type { WorkflowNode } from "@/lib/agents/workflow-nodes";

interface AgentWorkflowCanvasProps {
  nodes?: WorkflowNode[];
  emptyTitle?: string;
  emptyDescription?: string;
}

function nodeIcon(kind: WorkflowNode["kind"]) {
  switch (kind) {
    case "trigger":
      return Zap;
    case "ai":
      return Bot;
    case "decision":
      return Shield;
    default:
      return GitBranch;
  }
}

export default function AgentWorkflowCanvas({
  nodes,
  emptyTitle = "Your agent workflow will appear here",
  emptyDescription = "Describe what you want your agent to do below. Wave will design the workflow from your instructions.",
}: AgentWorkflowCanvasProps) {
  const hasNodes = nodes && nodes.length > 0;

  return (
    <div className="zws-canvas" aria-label="Agent workflow canvas">
      <div className="zws-canvas-grid" aria-hidden="true" />

      {!hasNodes ? (
        <div className="zws-canvas-empty">
          <div className="zws-canvas-empty-icon" aria-hidden="true">
            <GitBranch strokeWidth={1.5} />
          </div>
          <p className="zws-canvas-empty-title">{emptyTitle}</p>
          <p className="zws-canvas-empty-desc">{emptyDescription}</p>
        </div>
      ) : (
        <ol className="zws-flow">
          {nodes.map((node, index) => {
            const Icon = nodeIcon(node.kind);
            return (
              <li key={node.id} className="zws-flow-item">
                <article className={`zws-node zws-node-${node.kind}`}>
                  <span className="zws-node-icon" aria-hidden="true">
                    <Icon strokeWidth={2} />
                  </span>
                  <div className="zws-node-copy">
                    <h3 className="zws-node-title">{node.title}</h3>
                    {node.subtitle ? (
                      <p className="zws-node-subtitle">{node.subtitle}</p>
                    ) : null}
                  </div>
                </article>
                {index < nodes.length - 1 ? (
                  <span className="zws-flow-connector" aria-hidden="true">
                    ↓
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
