"use client";

import type { WorkflowGraphNode } from "@/lib/agents/workflow/types";

interface WorkflowNodeConfigPanelProps {
  node: WorkflowGraphNode | null;
  userEmail?: string | null;
  agentSlug?: string | null;
  onSave: (nodeId: string, patch: Partial<WorkflowGraphNode>) => void;
  onDelete: (nodeId: string) => void;
  onClose: () => void;
}

export default function WorkflowNodeConfigPanel({
  node,
  userEmail,
  agentSlug,
  onSave,
  onDelete,
  onClose,
}: WorkflowNodeConfigPanelProps) {
  if (!node) return null;

  const saveField = (patch: Partial<WorkflowGraphNode>) => {
    onSave(node.id, patch);
  };

  return (
    <aside className="wfb-config" aria-label="Step configuration">
      <div className="wfb-config-header">
        <h3>{node.name}</h3>
        <button type="button" className="wfb-config-close" onClick={onClose}>
          Close
        </button>
      </div>

      <label className="wfb-config-field">
        <span>Name</span>
        <input
          className="ds-input"
          value={node.name}
          onChange={(event) =>
            saveField({ name: event.target.value, description: node.description })
          }
        />
      </label>

      <label className="wfb-config-field">
        <span>Description</span>
        <textarea
          className="ds-input"
          rows={3}
          value={node.description}
          onChange={(event) =>
            saveField({ name: node.name, description: event.target.value })
          }
        />
      </label>

      {node.category === "trigger" ? (
        <>
          <label className="wfb-config-field">
            <span>Frequency</span>
            <select
              className="ds-input"
              value={node.config.schedule?.when ?? "manual"}
              onChange={(event) =>
                saveField({
                  config: {
                    ...node.config,
                    schedule: {
                      ...node.config.schedule,
                      when: event.target.value as "manual" | "daily" | "weekly" | "at_time" | "on_event",
                    },
                    triggerType:
                      event.target.value === "daily" || event.target.value === "weekly"
                        ? "schedule"
                        : node.config.triggerType,
                  },
                })
              }
            >
              <option value="manual">Manual</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="at_time">At a specific time</option>
              <option value="on_event">On event</option>
            </select>
          </label>
          <label className="wfb-config-field">
            <span>Time</span>
            <input
              className="ds-input"
              type="time"
              value={node.config.schedule?.time ?? "09:00"}
              onChange={(event) =>
                saveField({
                  config: {
                    ...node.config,
                    schedule: {
                      ...node.config.schedule,
                      time: event.target.value,
                    },
                  },
                })
              }
            />
          </label>
          <label className="wfb-config-field">
            <span>Timezone</span>
            <input
              className="ds-input"
              value={node.config.schedule?.timezone ?? "UTC"}
              onChange={(event) =>
                saveField({
                  config: {
                    ...node.config,
                    schedule: {
                      ...node.config.schedule,
                      timezone: event.target.value,
                    },
                  },
                })
              }
            />
          </label>
        </>
      ) : null}

      {node.type === "output_email" ? (
        <>
          <label className="wfb-config-field">
            <span>To</span>
            <input
              className="ds-input"
              type="email"
              value={node.config.email?.to ?? userEmail ?? ""}
              onChange={(event) =>
                saveField({
                  config: {
                    ...node.config,
                    email: {
                      ...node.config.email,
                      to: event.target.value,
                    },
                  },
                })
              }
            />
          </label>
          <label className="wfb-config-field">
            <span>Subject</span>
            <input
              className="ds-input"
              value={node.config.email?.subject ?? ""}
              placeholder="Workflow results"
              onChange={(event) =>
                saveField({
                  config: {
                    ...node.config,
                    email: {
                      ...node.config.email,
                      subject: event.target.value,
                    },
                  },
                })
              }
            />
          </label>
          <label className="wfb-config-field">
            <span>Send mode</span>
            <select
              className="ds-input"
              value={node.config.email?.sendMode ?? "after_workflow"}
              onChange={(event) =>
                saveField({
                  config: {
                    ...node.config,
                    email: {
                      ...node.config.email,
                      sendMode: event.target.value as "after_workflow" | "immediate",
                    },
                  },
                })
              }
            >
              <option value="after_workflow">After workflow completes</option>
              <option value="immediate">Immediately</option>
            </select>
          </label>
        </>
      ) : null}

      {node.category === "ai" ? (
        <label className="wfb-config-field">
          <span>Instructions</span>
          <textarea
            className="ds-input"
            rows={4}
            value={node.config.instructions ?? node.config.goal ?? ""}
            onChange={(event) =>
              saveField({
                config: {
                  ...node.config,
                  instructions: event.target.value,
                  goal: event.target.value,
                },
              })
            }
          />
        </label>
      ) : null}

      {node.category === "tool" || node.type === "output_email" ? (
        <label className="wfb-config-field">
          <span>Permission</span>
          <select
            className="ds-input"
            value={node.config.permissionLevel ?? "ask_approval"}
            onChange={(event) => {
              const permissionLevel = event.target.value as NonNullable<
                WorkflowGraphNode["config"]["permissionLevel"]
              >;
              if (permissionLevel === "automatic") {
                const confirmed = window.confirm(
                  "Automatically act is high-risk. Server policy still cannot be bypassed. Continue?"
                );
                if (!confirmed) return;
              }
              saveField({ config: { ...node.config, permissionLevel } });
            }}
          >
            <option value="disabled">Disabled</option>
            <option value="read_only">Read-only</option>
            <option value="draft_only">Draft only</option>
            <option value="ask_approval">Requires approval</option>
            <option value="automatic">Automatically act</option>
          </select>
        </label>
      ) : null}

      {node.type === "loop" ? (
        <label className="wfb-config-field">
          <span>Max iterations</span>
          <input
            className="ds-input"
            type="number"
            min={1}
            max={100}
            value={node.config.maxIterations ?? 10}
            onChange={(event) =>
              saveField({
                config: { ...node.config, maxIterations: Number(event.target.value) },
              })
            }
          />
        </label>
      ) : null}

      {node.config.placeholderIntegration ? (
        <p className="wfb-nl-note">Sample connector — not executable until wired.</p>
      ) : null}

      <div className="wfb-validation-actions" style={{ marginTop: "1rem" }}>
        <button
          type="button"
          className="wfb-btn wfb-btn-secondary"
          onClick={async () => {
            if (!agentSlug) return;
            const response = await fetch(
              `/api/v1/agents/${encodeURIComponent(agentSlug)}/workflow/test-node`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nodeId: node.id }),
              }
            );
            const payload = (await response.json()) as { error?: string; testHref?: string };
            window.alert(payload.error ?? "Could not test this node.");
            if (payload.testHref) window.location.href = payload.testHref;
          }}
        >
          Test this node
        </button>
        <button type="button" className="wfb-btn wfb-btn-ghost" onClick={() => onDelete(node.id)}>
          Delete node
        </button>
      </div>
    </aside>
  );
}
