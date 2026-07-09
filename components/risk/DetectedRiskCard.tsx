"use client";

import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ChevronDown,
  ChevronRight,
  Shield,
  Building2,
  Scale,
  Target,
  Lock,
  Lightbulb,
  Sparkles,
  Link2,
  Clock,
} from "lucide-react";
import SeverityBadge from "./SeverityBadge";
import type { DetectedRisk } from "@/lib/risk-types";

interface DetectedRiskCardProps {
  risk: DetectedRisk;
  defaultExpanded?: boolean;
}

function DetailRow({
  icon: Icon,
  label,
  value,
  highlight,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="defender-detail-row">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
        <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
        {label}
      </div>
      <p
        className={`mt-1.5 text-sm leading-relaxed ${
          highlight ? "text-[#2899f5]" : "text-zinc-300"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

export default function DetectedRiskCard({
  risk,
  defaultExpanded = false,
}: DetectedRiskCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <article className="defender-panel overflow-hidden transition-colors">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-start gap-4 p-4 text-left transition-colors hover:bg-white/2 sm:p-5"
        aria-expanded={expanded}
      >
        <div className="mt-0.5 shrink-0 text-zinc-500">
          {expanded ? (
            <ChevronDown className="h-4 w-4" strokeWidth={2} />
          ) : (
            <ChevronRight className="h-4 w-4" strokeWidth={2} />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <SeverityBadge severity={risk.severity} />
            <h3 className="text-sm font-semibold text-zinc-100 sm:text-base">
              {risk.title}
            </h3>
          </div>
          <p className="mt-2 line-clamp-2 text-sm text-zinc-500">{risk.explanation}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-600">
            <span className="font-mono">{risk.mitreAttack.techniqueId}</span>
            <span>{risk.mitreAttack.technique}</span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(risk.detectedAt).toLocaleString()}
            </span>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
            Confidence
          </p>
          <p className="font-mono text-lg font-bold text-zinc-200">{risk.confidence}%</p>
        </div>
      </button>

      {expanded && (
        <div className="defender-expand-content border-t border-white/6 px-4 pb-5 pt-4 sm:px-5 sm:pl-14">
          <div className="grid gap-5 lg:grid-cols-2">
            <DetailRow icon={Shield} label="Explanation" value={risk.explanation} />
            <DetailRow
              icon={Building2}
              label="Business Impact"
              value={risk.businessImpact}
            />
            <DetailRow
              icon={Scale}
              label="Compliance Impact"
              value={risk.complianceImpact}
            />
            <DetailRow
              icon={Target}
              label="MITRE ATT&CK Mapping"
              value={`${risk.mitreAttack.tactic} → ${risk.mitreAttack.technique} (${risk.mitreAttack.techniqueId})`}
              highlight
            />
            <DetailRow
              icon={Lock}
              label="OWASP Category"
              value={risk.owaspCategory}
            />
            <DetailRow
              icon={Lightbulb}
              label="Suggested Action"
              value={risk.suggestedAction}
            />
          </div>

          <div className="mt-5 rounded-lg border border-[#0078d4]/20 bg-[#0078d4]/8 p-4">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[#2899f5]">
              <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
              AI Recommendation
            </div>
            <p className="mt-2 text-sm leading-relaxed text-zinc-300">
              {risk.aiRecommendation}
            </p>
          </div>

          <div className="mt-5">
            <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              <Link2 className="h-3.5 w-3.5" strokeWidth={1.75} />
              Related Events ({risk.relatedEvents.length})
            </div>
            <div className="flex flex-col gap-2">
              {risk.relatedEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center gap-3 rounded-lg bg-white/2 px-3 py-2.5 ring-1 ring-white/6"
                >
                  <SeverityBadge severity={event.severity} size="sm" />
                  <span className="flex-1 truncate text-sm text-zinc-300">
                    {event.title}
                  </span>
                  <span className="shrink-0 font-mono text-xs text-zinc-600">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <p className="mt-4 font-mono text-xs text-zinc-600">
            Source: {risk.sourceLog}
          </p>
        </div>
      )}
    </article>
  );
}
