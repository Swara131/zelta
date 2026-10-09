import type { MonthlyProtectionSummary } from "@/lib/dashboard/trust-empty-states";

interface ApprovalsAllClearEmptyStateProps {
  summary: MonthlyProtectionSummary;
  className?: string;
}

export default function ApprovalsAllClearEmptyState({
  summary,
  className = "",
}: ApprovalsAllClearEmptyStateProps) {
  return (
    <div
      className={`te-all-clear ds-panel ${className}`.trim()}
      role="status"
      aria-labelledby="te-all-clear-heading"
    >
      <h3 id="te-all-clear-heading" className="te-all-clear-title">
        All clear ✓
      </h3>

      {summary.hasActivity ? (
        <>
          <p className="te-all-clear-lead">
            Your agents ran{" "}
            <strong>{summary.totalActions.toLocaleString()}</strong> action
            {summary.totalActions === 1 ? "" : "s"} this month.
          </p>

          <ul className="te-all-clear-stats">
            <li>
              <span className="te-all-clear-stat-value">{summary.autoApproved}</span>
              <span className="te-all-clear-stat-label">auto-approved (low risk)</span>
            </li>
            <li>
              <span className="te-all-clear-stat-value">{summary.flaggedReviewed}</span>
              <span className="te-all-clear-stat-label">
                flagged (you reviewed &amp; approved)
              </span>
            </li>
          </ul>

          <p className="te-all-clear-message">
            This means: Your protection rules are working perfectly. You&apos;re seeing real
            value.
          </p>
        </>
      ) : (
        <>
          <p className="te-all-clear-lead">
            Nothing is waiting on you — your protection rules are armed and ready.
          </p>
          <p className="te-all-clear-message">
            When agents run actions, low-risk ones auto-approve and flagged ones will appear here
            for your review.
          </p>
        </>
      )}
    </div>
  );
}
