"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Copy, Check, Terminal, ArrowUpRight } from "lucide-react";
import { buildProposeExamples } from "@/lib/gateway/integration-examples";
import SectionHeading from "./SectionHeading";

type LangTab = "curl" | "typescript" | "python";

const TABS: { id: LangTab; label: string }[] = [
  { id: "curl", label: "cURL" },
  { id: "typescript", label: "TypeScript" },
  { id: "python", label: "Python" },
];

export default function DeveloperCodeSection() {
  const [lang, setLang] = useState<LangTab>("typescript");
  const [copied, setCopied] = useState(false);

  const code = useMemo(() => {
    const examples = buildProposeExamples({
      baseUrl: "https://your-app.approvalayer.app",
      agentId: "agent_prod_01",
    });
    return examples[lang];
  }, [lang]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <section id="developers" className="py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Developers"
          title="Integrate in minutes"
          description="Propose actions over HTTP with agent API keys. Poll status for review outcomes, then verify execution with a one-time token."
          accent="violet"
        />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="landing-glass-panel overflow-hidden rounded-3xl"
        >
          <div className="flex flex-col gap-4 border-b border-white/8 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <Terminal className="h-4 w-4 text-indigo-400" strokeWidth={2} aria-hidden="true" />
              POST /api/v1/actions/propose
            </div>
            <div className="flex flex-wrap gap-2">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setLang(tab.id)}
                  className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                    lang === tab.id
                      ? "bg-indigo-500/20 text-indigo-200 ring-1 ring-indigo-400/30"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                  aria-pressed={lang === tab.id}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="relative">
            <pre className="max-h-[420px] overflow-x-auto p-6 text-[13px] leading-relaxed">
              <code className="font-mono text-zinc-300">{code}</code>
            </pre>
            <button
              type="button"
              onClick={handleCopy}
              className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-zinc-300 backdrop-blur-sm transition-colors hover:bg-black/60"
              aria-label={copied ? "Copied" : "Copy code example"}
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" strokeWidth={2} />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" strokeWidth={2} />
                  Copy
                </>
              )}
            </button>
          </div>

          <div className="flex flex-col items-start justify-between gap-4 border-t border-white/8 px-6 py-5 sm:flex-row sm:items-center">
            <p className="text-sm text-zinc-500">
              SDK helpers available via{" "}
              <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-xs text-zinc-400">
                ApprovalLayerClient
              </code>
            </p>
            <Link
              href="/integrations"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-300 transition-colors hover:text-indigo-200"
            >
              Full integration guide
              <ArrowUpRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
