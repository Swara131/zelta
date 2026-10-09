"use client";

import { Shield } from "lucide-react";
import { labelAgentTool } from "@/lib/agents/tool-labels";

export interface AgentContextPanelData {
  name?: string;
  statusLabel?: string;
  statusTone?: "ready" | "active" | "paused" | "building" | "idle";
  purpose?: string;
  tools?: string[];
  schedule?: string;
  protected?: boolean;
}

interface AgentContextPanelProps {
  data: AgentContextPanelData;
}

function statusClass(tone: AgentContextPanelData["statusTone"]): string {
  switch (tone) {
    case "active":
      return "zws-status-active";
    case "paused":
      return "zws-status-paused";
    case "building":
      return "zws-status-building";
    case "ready":
      return "zws-status-ready";
    default:
      return "zws-status-idle";
  }
}

export default function AgentContextPanel({ data }: AgentContextPanelProps) {
  const hasAgent = Boolean(data.name);

  return (
    <aside className="zws-context" aria-label="Agent details">
      <div className="zws-context-section">
        <p className="zws-context-label">Agent</p>
        {hasAgent ? (
          <p className="zws-context-value">{data.name}</p>
        ) : (
          <p className="zws-context-muted">No agent selected yet</p>
        )}
      </div>

      <div className="zws-context-section">
        <p className="zws-context-label">Status</p>
        {data.statusLabel ? (
          <p className={`zws-status ${statusClass(data.statusTone)}`}>
            <span className="zws-status-dot" aria-hidden="true" />
            {data.statusLabel}
          </p>
        ) : (
          <p className="zws-context-muted">—</p>
        )}
      </div>

      {data.purpose ? (
        <div className="zws-context-section">
          <p className="zws-context-label">Purpose</p>
          <p className="zws-context-body">{data.purpose}</p>
        </div>
      ) : null}

      <div className="zws-context-section">
        <p className="zws-context-label">Tools</p>
        {data.tools && data.tools.length > 0 ? (
          <ul className="zws-tool-list">
            {data.tools.map((tool) => (
              <li key={tool}>{labelAgentTool(tool)}</li>
            ))}
          </ul>
        ) : (
          <p className="zws-context-muted">Tools appear after you create an agent</p>
        )}
      </div>

      {data.schedule ? (
        <div className="zws-context-section">
          <p className="zws-context-label">Schedule</p>
          <p className="zws-context-body">{data.schedule}</p>
        </div>
      ) : null}

      <div className="zws-context-section">
        <p className="zws-context-label">Safety</p>
        <p className="zws-safety-row">
          <Shield className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          {data.protected === false ? "Not configured" : "Protected"}
        </p>
      </div>
    </aside>
  );
}
