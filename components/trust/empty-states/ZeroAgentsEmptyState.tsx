import Link from "next/link";
import { ArrowRight, PlayCircle, Sparkles } from "lucide-react";
import {
  PLATFORM_TRUST_STATS,
  SETUP_VIDEO_HREF,
} from "@/lib/dashboard/trust-empty-states";

interface ZeroAgentsEmptyStateProps {
  onCreateAgent?: () => void;
  createHref?: string;
  /** Compact layout for inline sections (e.g. “Your agents” when examples exist). */
  variant?: "full" | "compact";
  className?: string;
}

export default function ZeroAgentsEmptyState({
  onCreateAgent,
  createHref = "/agents/create",
  variant = "full",
  className = "",
}: ZeroAgentsEmptyStateProps) {
  const isCompact = variant === "compact";

  return (
    <section
      className={`te-zero-agents ds-panel ${isCompact ? "te-zero-agents-compact" : ""} ${className}`.trim()}
      aria-labelledby={isCompact ? "te-zero-agents-compact-heading" : "te-zero-agents-heading"}
    >
      <h2
        id={isCompact ? "te-zero-agents-compact-heading" : "te-zero-agents-heading"}
        className="te-zero-agents-title"
      >
        Ready to protect your first agent?
      </h2>

      <p className="te-zero-agents-kicker">Choose your path:</p>

      <div className="te-zero-agents-paths">
        {onCreateAgent ? (
          <button
            type="button"
            className="te-zero-agents-path te-zero-agents-path-primary"
            onClick={onCreateAgent}
          >
            <span className="te-zero-agents-path-icon" aria-hidden="true">
              ✨
            </span>
            <span className="te-zero-agents-path-body">
              <span className="te-zero-agents-path-label">Build with Wave</span>
              <span className="te-zero-agents-path-meta">Create from scratch (60 seconds)</span>
            </span>
            <ArrowRight className="te-zero-agents-path-arrow" strokeWidth={2} aria-hidden="true" />
          </button>
        ) : (
          <Link href={createHref} className="te-zero-agents-path te-zero-agents-path-primary">
            <span className="te-zero-agents-path-icon" aria-hidden="true">
              ✨
            </span>
            <span className="te-zero-agents-path-body">
              <span className="te-zero-agents-path-label">Build with Wave</span>
              <span className="te-zero-agents-path-meta">Create from scratch (60 seconds)</span>
            </span>
            <ArrowRight className="te-zero-agents-path-arrow" strokeWidth={2} aria-hidden="true" />
          </Link>
        )}

        <Link href="/agents/create" className="te-zero-agents-path te-zero-agents-path-secondary">
          <span className="te-zero-agents-path-icon" aria-hidden="true">
            🔌
          </span>
          <span className="te-zero-agents-path-body">
            <span className="te-zero-agents-path-label">Connect existing</span>
            <span className="te-zero-agents-path-meta">
              Use your LangChain/custom agent (3 minutes)
            </span>
          </span>
          <ArrowRight className="te-zero-agents-path-arrow" strokeWidth={2} aria-hidden="true" />
        </Link>
      </div>

      {!isCompact ? (
        <>
          <div className="te-zero-agents-why">
            <h3 className="te-zero-agents-why-title">
              <Sparkles className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              Why Wave?
            </h3>
            <ul className="te-zero-agents-stats">
              {PLATFORM_TRUST_STATS.map((stat) => (
                <li key={stat}>{stat}</li>
              ))}
            </ul>
          </div>

          <p className="te-zero-agents-video">
            Questions?{" "}
            <Link href={SETUP_VIDEO_HREF} className="te-zero-agents-video-link">
              <PlayCircle className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              Watch 2-minute setup video
            </Link>
          </p>
        </>
      ) : null}
    </section>
  );
}
