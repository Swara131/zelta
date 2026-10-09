import { AlertTriangle, Ban, Check } from "lucide-react";
import { decisionBadgeLabel } from "@/lib/safety/center/copy";
import type { SafetyDecisionLabel } from "@/lib/safety/center/types";

export function DecisionBadge({ decision }: { decision: SafetyDecisionLabel }) {
  const label = decisionBadgeLabel(decision);

  if (decision === "BLOCK") {
    return (
      <span className="sc-badge sc-badge-block">
        <Ban className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
        {label}
      </span>
    );
  }

  if (decision === "REQUIRE_APPROVAL") {
    return (
      <span className="sc-badge sc-badge-review">
        <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
        {label}
      </span>
    );
  }

  return (
    <span className="sc-badge sc-badge-allow">
      <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
      {label}
    </span>
  );
}

export function ProtectionStatusBadge({
  status,
}: {
  status: "active" | "paused" | "inactive";
}) {
  const label =
    status === "active" ? "Protected" : status === "paused" ? "Paused" : "Inactive";
  const tone =
    status === "active" ? "sc-status-active" : status === "paused" ? "sc-status-paused" : "sc-status-inactive";

  return (
    <span className={`sc-status-badge ${tone}`}>
      <span className="sc-status-dot" aria-hidden="true" />
      {label}
    </span>
  );
}

export function PolicyStatusBadge({ status }: { status: string }) {
  const normalized = status.replace(/_/g, " ").toLowerCase();
  const isActive = normalized === "active";

  return (
    <span className={`sc-status-badge ${isActive ? "sc-status-active" : "sc-status-inactive"}`}>
      <span className="sc-status-dot" aria-hidden="true" />
      {normalized}
    </span>
  );
}
