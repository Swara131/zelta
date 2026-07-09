"use client";

interface SyntaxToken {
  text: string;
  className: string;
}

function tokenizeJsonLine(line: string): SyntaxToken[] {
  const tokens: SyntaxToken[] = [];
  const regex =
    /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\{|\}|\[|\]|,|:|\s+/g;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(line)) !== null) {
    const [raw] = match;
    if (!raw) continue;

    if (/^\s+$/.test(raw)) {
      tokens.push({ text: raw, className: "" });
    } else if (match[2]) {
      tokens.push({ text: match[1], className: "syntax-key" });
      tokens.push({ text: match[2], className: "syntax-punct" });
    } else if (/^"/.test(raw)) {
      const isRisk =
        raw.includes("high") ||
        raw.includes("critical") ||
        raw.includes("medium") ||
        raw.includes("low");
      const isAction = raw.includes("file_") || raw.includes("shell_") || raw.includes("database_") || raw.includes("permission_") || raw.includes("network_") || raw.includes("api_");
      if (raw.includes("critical") || raw.includes("high")) {
        tokens.push({ text: raw, className: "syntax-risk-high" });
      } else if (raw.includes("medium")) {
        tokens.push({ text: raw, className: "syntax-risk-medium" });
      } else if (raw.includes("low")) {
        tokens.push({ text: raw, className: "syntax-risk-low" });
      } else if (isAction) {
        tokens.push({ text: raw, className: "syntax-action" });
      } else if (raw.match(/agent-|sess_/)) {
        tokens.push({ text: raw, className: "syntax-id" });
      } else if (raw.match(/T\d{2}:/)) {
        tokens.push({ text: raw, className: "syntax-timestamp" });
      } else {
        tokens.push({ text: raw, className: "syntax-string" });
      }
    } else if (/^(true|false|null)$/.test(raw)) {
      tokens.push({ text: raw, className: "syntax-boolean" });
    } else if (/^-?\d/.test(raw)) {
      tokens.push({ text: raw, className: "syntax-number" });
    } else if (/^[\{\}\[\],:]$/.test(raw)) {
      tokens.push({ text: raw, className: "syntax-punct" });
    } else {
      tokens.push({ text: raw, className: "" });
    }
  }

  return tokens.length ? tokens : [{ text: line, className: "" }];
}

interface TechnicalLogPanelProps {
  content: string;
  activeLine?: number;
}

export default function TechnicalLogPanel({ content, activeLine }: TechnicalLogPanelProps) {
  const lines = content.split("\n").filter(Boolean);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
          </div>
          <span className="ml-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
            Original Technical Log
          </span>
        </div>
        <span className="font-mono text-xs text-zinc-600">{lines.length} lines</span>
      </div>

      <div className="log-scroll flex-1 overflow-auto">
        {lines.length === 0 ? (
          <div className="flex h-full min-h-[320px] flex-col items-center justify-center p-8 text-center">
            <p className="text-sm text-zinc-500">No log content loaded</p>
            <p className="mt-1 text-xs text-zinc-600">
              Upload a file above to view the technical log
            </p>
          </div>
        ) : (
          <pre className="p-0 font-mono text-[13px] leading-6">
            {lines.map((line, idx) => {
              const lineNum = idx + 1;
              const tokens = tokenizeJsonLine(line);
              const isActive = activeLine === lineNum;

              return (
                <div
                  key={lineNum}
                  className={`log-line flex ${isActive ? "log-line-active" : ""}`}
                >
                  <span className="log-gutter select-none px-4 py-0.5 text-right text-zinc-600">
                    {lineNum}
                  </span>
                  <code className="flex-1 overflow-x-auto px-4 py-0.5 text-zinc-300">
                    {tokens.map((token, i) => (
                      <span key={i} className={token.className}>
                        {token.text}
                      </span>
                    ))}
                  </code>
                </div>
              );
            })}
          </pre>
        )}
      </div>
    </div>
  );
}
