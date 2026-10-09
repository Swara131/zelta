"use client";

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { safeHttpUrl } from "@/lib/agents/results/parse-agent-result";

function safeUrl(url: string): string {
  return safeHttpUrl(url) ?? "";
}

export default function MarkdownDocument({ markdown }: { markdown: string }) {
  if (!markdown.trim()) return null;

  return (
    <div className="wave-md">
      <Markdown
        remarkPlugins={[remarkGfm]}
        urlTransform={safeUrl}
        components={{
          a: ({ href, children }) => {
            const safe = safeHttpUrl(href);
            if (!safe) return <span>{children}</span>;
            return (
              <a href={safe} target="_blank" rel="noreferrer noopener">
                {children}
              </a>
            );
          },
          table: ({ children }) => (
            <div className="wave-md-table-wrap">
              <table>{children}</table>
            </div>
          ),
          pre: ({ children }) => <pre className="wave-md-pre">{children}</pre>,
        }}
      >
        {markdown}
      </Markdown>
    </div>
  );
}
