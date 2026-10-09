"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import {
  WORKFLOW_NODE_CATALOG,
  categoryLabel,
  createCatalogNode,
} from "@/lib/agents/workflow/node-definitions";
import type { WorkflowGraphNode, WorkflowNodeCategory } from "@/lib/agents/workflow/types";

interface AddWorkflowNodeMenuProps {
  onAdd: (node: WorkflowGraphNode) => void;
  nextPosition: number;
}

const CATEGORY_ORDER: WorkflowNodeCategory[] = [
  "trigger",
  "ai",
  "tool",
  "logic",
  "data",
  "output",
  "safety",
];

export default function AddWorkflowNodeMenu({
  onAdd,
  nextPosition,
}: AddWorkflowNodeMenuProps) {
  const [open, setOpen] = useState(false);

  const grouped = useMemo(() => {
    const unique = new Map<string, (typeof WORKFLOW_NODE_CATALOG)[number]>();
    for (const item of WORKFLOW_NODE_CATALOG) {
      if (item.type === "safety_gate") {
        unique.set(item.type, item);
      } else if (item.type === "tool") {
        unique.set(`tool:${item.toolName}`, item);
      } else if (!unique.has(item.type)) {
        unique.set(item.type, item);
      }
    }

    const byCategory = new Map<WorkflowNodeCategory, (typeof WORKFLOW_NODE_CATALOG)[number][]>();
    for (const item of unique.values()) {
      const list = byCategory.get(item.category) ?? [];
      list.push(item);
      byCategory.set(item.category, list);
    }
    return byCategory;
  }, []);

  const handleAdd = (type: string, toolName?: string) => {
    const node = createCatalogNode(type as WorkflowGraphNode["type"], nextPosition, toolName);
    if (!node) return;
    onAdd(node);
    setOpen(false);
  };

  return (
    <div className="wfb-add-wrap">
      <button
        type="button"
        className="wfb-add-btn"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
        Add step
      </button>

      {open ? (
        <div className="wfb-add-menu" role="menu">
          {CATEGORY_ORDER.map((category) => {
            const items = grouped.get(category);
            if (!items?.length) return null;
            return (
              <div key={category} className="wfb-add-group">
                <p className="wfb-add-group-label">{categoryLabel(category)}</p>
                <ul>
                  {items.map((item) => (
                    <li key={`${item.type}-${item.toolName ?? ""}`}>
                      <button
                        type="button"
                        className="wfb-add-option"
                        role="menuitem"
                        onClick={() => handleAdd(item.type, item.toolName)}
                      >
                        <span aria-hidden="true">{item.icon}</span>
                        <span>
                          <strong>{item.label}</strong>
                          <small>{item.description}</small>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
