import type { RiskSeverity } from "@/lib/risk-types";
import type { ApprovalPriority } from "@/lib/approval-types";

/** Business tiers used by the approval engine (maps from risk severity). */
export type ApprovalTier = "safe" | "medium" | "high" | "critical";

export interface ApprovalRule {
  tier: ApprovalTier;
  requiredApprovals: number;
  autoApprove: boolean;
  label: string;
}

const RULES: Record<ApprovalTier, ApprovalRule> = {
  safe: {
    tier: "safe",
    requiredApprovals: 0,
    autoApprove: true,
    label: "Safe — automatically approved",
  },
  medium: {
    tier: "medium",
    requiredApprovals: 1,
    autoApprove: false,
    label: "Medium — requires 1 approval",
  },
  high: {
    tier: "high",
    requiredApprovals: 2,
    autoApprove: false,
    label: "High — requires 2 approvals",
  },
  critical: {
    tier: "critical",
    requiredApprovals: 3,
    autoApprove: false,
    label: "Critical — requires 3 approvals",
  },
};

/** Maps database risk severity to approval tier. `low` is treated as Safe. */
export function severityToTier(severity: RiskSeverity): ApprovalTier {
  switch (severity) {
    case "low":
      return "safe";
    case "medium":
      return "medium";
    case "high":
      return "high";
    case "critical":
      return "critical";
    default:
      return "medium";
  }
}

export function getApprovalRule(severity: RiskSeverity): ApprovalRule {
  return RULES[severityToTier(severity)];
}

export function getRequiredApprovals(severity: RiskSeverity): number {
  return getApprovalRule(severity).requiredApprovals;
}

export function shouldAutoApprove(severity: RiskSeverity): boolean {
  return getApprovalRule(severity).autoApprove;
}

export function severityToPriority(severity: RiskSeverity): ApprovalPriority {
  switch (severity) {
    case "critical":
      return "p1";
    case "high":
      return "p2";
    case "medium":
      return "p3";
    case "low":
      return "p4";
    default:
      return "p3";
  }
}

/** SLA window in hours before deadline by severity. */
export function slaHoursForSeverity(severity: RiskSeverity): number {
  switch (severity) {
    case "critical":
      return 4;
    case "high":
      return 8;
    case "medium":
      return 24;
    case "low":
      return 48;
    default:
      return 24;
  }
}

export function computeSlaDeadline(severity: RiskSeverity, from = new Date()): string {
  const hours = slaHoursForSeverity(severity);
  return new Date(from.getTime() + hours * 60 * 60 * 1000).toISOString();
}

export function isApprovalComplete(
  requiredApprovals: number,
  approvalsReceived: number
): boolean {
  return approvalsReceived >= requiredApprovals && requiredApprovals > 0;
}

export function remainingApprovals(
  requiredApprovals: number,
  approvalsReceived: number
): number {
  return Math.max(0, requiredApprovals - approvalsReceived);
}

export const APPROVAL_RULES = RULES;
