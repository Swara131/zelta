"use client";

import { useMemo, useState } from "react";
import {
  Check,
  Copy,
  Download,
  RefreshCw,
} from "lucide-react";
import MarkdownDocument from "@/components/agents/results/MarkdownDocument";
import {
  parseAgentResult,
  tableToCsv,
  type ParsedAgentResult,
} from "@/lib/agents/results/parse-agent-result";

export interface AgentResultRendererProps {
  result?: unknown;
  status?: string | null;
  error?: string | null;
  executionDetails?: unknown;
  variant?: "document" | "compact" | "chat";
  onRetry?: () => void;
  reconnectHref?: string;
  reconnectLabel?: string;
}

function kindLabel(kind: ParsedAgentResult["kind"]): string | null {
  switch (kind) {
    case "schedule":
      return "Schedule";
    case "table":
      return "Table";
    case "research":
      return "Research";
    case "decision":
      return "Decision";
    case "report":
      return "Report";
    case "list":
      return "List";
    case "action_result":
      return "Action result";
    default:
      return null;
  }
}

async function copyText(value: string) {
  await navigator.clipboard.writeText(value);
}

function downloadFile(filename: string, contents: string, type: string) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function AgentResultRenderer({
  result,
  status,
  error,
  executionDetails,
  variant = "document",
  onRetry,
  reconnectHref,
  reconnectLabel = "Reconnect",
}: AgentResultRendererProps) {
  const parsed = useMemo(() => parseAgentResult(result ?? error), [error, result]);
  const [copied, setCopied] = useState<"all" | "table" | null>(null);
  const failed = status === "failed" || status === "timeout" || Boolean(error && !result);

  const markCopied = (key: "all" | "table") => {
    setCopied(key);
    window.setTimeout(() => setCopied(null), 1600);
  };

  if (failed) {
    return (
      <div className={`wave-result wave-result-${variant} wave-result-error`}>
        <p className="wave-result-kicker">Agent couldn&apos;t complete this run.</p>
        <p className="wave-result-reason">
          <strong>Reason:</strong> {error?.trim() || "Something went wrong while running this agent."}
        </p>
        <p className="wave-result-help">What you can do:</p>
        <ul>
          <li>Check the connected tools and try again.</li>
          {reconnectHref ? <li>Reconnect the integration if a required tool is unavailable.</li> : null}
        </ul>
        <div className="wave-result-actions">
          {reconnectHref ? (
            <a className="prep-btn prep-btn-primary" href={reconnectHref}>
              {reconnectLabel}
            </a>
          ) : null}
          {onRetry ? (
            <button type="button" className="prep-btn prep-btn-secondary" onClick={onRetry}>
              <RefreshCw className="h-4 w-4" strokeWidth={2} />
              Try again
            </button>
          ) : null}
        </div>
        {executionDetails ? (
          <details className="wave-result-debug">
            <summary>View technical details</summary>
            <pre>{typeof executionDetails === "string" ? executionDetails : JSON.stringify(executionDetails, null, 2)}</pre>
          </details>
        ) : null}
      </div>
    );
  }

  if (!parsed.markdown && !parsed.decision) {
    return null;
  }

  const label = kindLabel(parsed.kind);

  return (
    <div className={`wave-result wave-result-${variant}`}>
      {label && variant !== "chat" ? <p className="wave-result-kind">{label}</p> : null}

      {parsed.decision && (parsed.decision.status || parsed.decision.risk) ? (
        <section className="wave-result-decision" aria-label="Decision">
          <h3>Action</h3>
          <dl>
            {parsed.decision.action ? (
              <>
                <dt>Action</dt>
                <dd>{parsed.decision.action}</dd>
              </>
            ) : null}
            {parsed.decision.amount ? (
              <>
                <dt>Amount</dt>
                <dd>{parsed.decision.amount}</dd>
              </>
            ) : null}
            {parsed.decision.risk ? (
              <>
                <dt>Risk</dt>
                <dd>{parsed.decision.risk}</dd>
              </>
            ) : null}
            {parsed.decision.policy ? (
              <>
                <dt>Policy</dt>
                <dd>{parsed.decision.policy}</dd>
              </>
            ) : null}
            {parsed.decision.status ? (
              <>
                <dt>Decision</dt>
                <dd>{parsed.decision.status}</dd>
              </>
            ) : null}
            {parsed.decision.reason ? (
              <>
                <dt>Reason</dt>
                <dd>{parsed.decision.reason}</dd>
              </>
            ) : null}
          </dl>
        </section>
      ) : null}

      <MarkdownDocument markdown={parsed.markdown} />

      {parsed.sources.length > 0 ? (
        <section className="wave-result-sources" aria-label="Sources">
          <h3>Sources</h3>
          <ol>
            {parsed.sources.map((source, index) => (
              <li key={`${source.title}-${index}`}>
                {source.url ? (
                  <a href={source.url} target="_blank" rel="noreferrer noopener">
                    {source.title}
                    {source.domain ? <span> — {source.domain}</span> : null}
                  </a>
                ) : (
                  source.title
                )}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {parsed.warnings.length > 0 ? (
        <p className="wave-result-warning">{parsed.warnings.join(" ")}</p>
      ) : null}

      {variant !== "chat" ? (
        <div className="wave-result-actions">
          <button
            type="button"
            className="prep-btn prep-btn-secondary"
            onClick={() => {
              void copyText(parsed.markdown).then(() => markCopied("all"));
            }}
          >
            {copied === "all" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied === "all" ? "Copied" : "Copy"}
          </button>
          <button
            type="button"
            className="prep-btn prep-btn-secondary"
            onClick={() => downloadFile("agent-result.md", parsed.markdown, "text/markdown")}
          >
            <Download className="h-4 w-4" />
            Download
          </button>
          {parsed.tables[0] ? (
            <>
              <button
                type="button"
                className="prep-btn prep-btn-secondary"
                onClick={() => {
                  void copyText(tableToCsv(parsed.tables[0]!)).then(() => markCopied("table"));
                }}
              >
                {copied === "table" ? "Copied table" : "Copy table"}
              </button>
              <button
                type="button"
                className="prep-btn prep-btn-secondary"
                onClick={() =>
                  downloadFile("agent-result.csv", tableToCsv(parsed.tables[0]!), "text/csv")
                }
              >
                Export CSV
              </button>
            </>
          ) : null}
          {onRetry ? (
            <button type="button" className="prep-btn prep-btn-secondary" onClick={onRetry}>
              Run again
            </button>
          ) : null}
        </div>
      ) : null}

      {executionDetails && variant === "document" ? (
        <details className="wave-result-debug">
          <summary>View execution details</summary>
          <pre>{typeof executionDetails === "string" ? executionDetails : JSON.stringify(executionDetails, null, 2)}</pre>
        </details>
      ) : null}
    </div>
  );
}
