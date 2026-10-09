import { CheckCircle2, XCircle, AlertTriangle, Clock, Link2Off } from "lucide-react";
import type { EmailApprovalResult } from "@/lib/gateway/email-approval/process-action";

const ICONS = {
  approved: CheckCircle2,
  denied: XCircle,
  already_used: Clock,
  expired: Clock,
  invalid: Link2Off,
  not_found: Link2Off,
  proposal_unavailable: AlertTriangle,
} as const;

const ACCENTS = {
  approved: "#22c55e",
  denied: "#ef4444",
  already_used: "#eab308",
  expired: "#eab308",
  invalid: "#71717a",
  not_found: "#71717a",
  proposal_unavailable: "#f97316",
} as const;

interface EmailDecisionResultPageProps {
  result: EmailApprovalResult;
}

export default function EmailDecisionResultPage({ result }: EmailDecisionResultPageProps) {
  const Icon = ICONS[result.kind];
  const accent = ACCENTS[result.kind];

  return (
    <div className="min-h-screen bg-[#0f1117] text-[#fafafa] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <p className="text-center text-lg font-bold tracking-tight mb-8">Wave</p>
        <div
          className="rounded-2xl border border-[#27272a] bg-[#18181b] overflow-hidden shadow-xl"
          style={{ borderTopWidth: 4, borderTopColor: accent }}
        >
          <div className="p-8 sm:p-10 text-center">
            <div
              className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full"
              style={{ backgroundColor: `${accent}22`, color: accent }}
            >
              <Icon className="h-7 w-7" aria-hidden />
            </div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight mb-3">
              {result.title}
            </h1>
            <p className="text-sm sm:text-base leading-relaxed text-[#a1a1aa]">
              {result.message}
            </p>
            {(result.toolName || result.agentId) && (
              <dl className="mt-8 text-left text-sm space-y-3 border-t border-[#27272a] pt-6">
                {result.agentId ? (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-[#71717a]">Agent</dt>
                    <dd className="mt-1 text-[#e4e4e7]">{result.agentId}</dd>
                  </div>
                ) : null}
                {result.toolName ? (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-[#71717a]">Action</dt>
                    <dd className="mt-1 text-[#e4e4e7]">{result.toolName}</dd>
                  </div>
                ) : null}
              </dl>
            )}
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-[#52525b]">
          AI agent safety &amp; control · Wave
        </p>
      </div>
    </div>
  );
}
