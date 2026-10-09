"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import type { CodeSnippetSegment } from "@/lib/onboarding/connection-setup-wizard";

interface CodeSnippetBlockProps {
  segments: CodeSnippetSegment[];
  /** Plain text for clipboard */
  copyText: string;
  className?: string;
}

export default function CodeSnippetBlock({
  segments,
  copyText,
  className = "",
}: CodeSnippetBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(copyText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`csw-code-block ${className}`.trim()}>
      <div className="csw-code-head">
        <span className="csw-code-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <button type="button" className="csw-code-copy" onClick={() => void handleCopy()}>
          {copied ? (
            <Check className="h-3.5 w-3.5 text-emerald-400" strokeWidth={2.5} />
          ) : (
            <Copy className="h-3.5 w-3.5" strokeWidth={2} />
          )}
          {copied ? "✓ Copied!" : "Copy"}
        </button>
      </div>
      <pre className="csw-code-pre">
        <code>
          {segments.map((segment, index) => {
            const classes = [
              segment.token ?? "",
              segment.customize ? "csw-code-customize" : "",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <span key={`${index}-${segment.text.slice(0, 12)}`} className={classes || undefined}>
                {segment.text}
              </span>
            );
          })}
        </code>
      </pre>
    </div>
  );
}
