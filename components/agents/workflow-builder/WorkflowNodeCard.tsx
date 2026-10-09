"use client";

import type { HTMLAttributes } from "react";
import { GripVertical, Pencil, Trash2 } from "lucide-react";
import type { WorkflowGraphNode } from "@/lib/agents/workflow/types";

interface WorkflowNodeCardProps {
  node: WorkflowGraphNode;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onEdit: () => void;
  dragHandleProps?: HTMLAttributes<HTMLButtonElement>;
}

export default function WorkflowNodeCard({
  node,
  selected,
  onSelect,
  onDelete,
  onEdit,
  dragHandleProps,
}: WorkflowNodeCardProps) {
  const canDelete = node.category !== "safety";

  return (
    <article
      className={`wfb-node wfb-node-${node.category} wfb-node-status-${node.status}${
        selected ? " is-selected" : ""
      }`}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`${node.name} workflow step`}
    >
      <div className="wfb-node-toolbar">
        <button
          type="button"
          className="wfb-node-drag"
          aria-label="Reorder step"
          {...dragHandleProps}
          onClick={(event) => event.stopPropagation()}
        >
          <GripVertical className="h-4 w-4" strokeWidth={2} />
        </button>
        <div className="wfb-node-actions">
          <button
            type="button"
            className="wfb-node-action"
            aria-label="Edit step"
            onClick={(event) => {
              event.stopPropagation();
              onEdit();
            }}
          >
            <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
          {canDelete ? (
            <button
              type="button"
              className="wfb-node-action wfb-node-action-danger"
              aria-label="Delete step"
              onClick={(event) => {
                event.stopPropagation();
                onDelete();
              }}
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          ) : null}
        </div>
      </div>

      <span className="wfb-node-icon" aria-hidden="true">
        {nodeIcon(node)}
      </span>
      <p className="wfb-node-type">{nodeTypeLabel(node)}</p>
      <h3 className="wfb-node-title">{node.name}</h3>
      {node.description ? <p className="wfb-node-desc">{node.description}</p> : null}
    </article>
  );
}

function nodeIcon(node: WorkflowGraphNode): string {
  switch (node.type) {
    case "trigger_schedule":
      return "⏰";
    case "trigger_manual":
      return "👆";
    case "trigger_webhook":
      return "📡";
    case "ai_reasoning":
      return "🧠";
    case "ai_generation":
      return "✨";
    case "ai_classification":
      return "🏷️";
    case "safety_gate":
      return "🛡️";
    case "output_email":
      return "✉️";
    case "output_notification":
      return "🔔";
    case "output_response":
      return "💬";
    case "condition":
      return "◆";
    case "branch":
      return "⑂";
    case "tool":
      if (node.config.toolName === "web_search") return "🔍";
      if (node.config.toolName === "send_email") return "✉️";
      return "🔧";
    default:
      return "•";
  }
}

function nodeTypeLabel(node: WorkflowGraphNode): string {
  switch (node.category) {
    case "trigger":
      return "Trigger";
    case "ai":
      return "AI";
    case "tool":
      return "Tool";
    case "logic":
      return "Logic";
    case "data":
      return "Data";
    case "output":
      return "Output";
    case "safety":
      return "Safety";
    default:
      return "Step";
  }
}
