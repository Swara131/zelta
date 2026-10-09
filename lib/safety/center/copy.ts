import type { SafetyDecisionLabel } from "./types";

export function decisionLabel(decision: SafetyDecisionLabel): string {
  switch (decision) {
    case "ALLOW":
      return "Allowed";
    case "REQUIRE_APPROVAL":
      return "Approval required";
    case "BLOCK":
      return "Blocked";
  }
}

export function decisionBadgeLabel(decision: SafetyDecisionLabel): string {
  switch (decision) {
    case "ALLOW":
      return "ALLOWED";
    case "REQUIRE_APPROVAL":
      return "APPROVAL REQUIRED";
    case "BLOCK":
      return "BLOCKED";
  }
}

export function founderReasonForEvent(params: {
  decision: SafetyDecisionLabel;
  runtimeEvent?: string | null;
  reason?: string | null;
  matchedPolicy?: string | null;
}): string {
  const reason = params.reason?.trim();
  if (reason && reason.length > 20 && !reason.startsWith("policy.")) {
    if (reason.toLowerCase().includes("mission")) {
      return "Blocked because this action is outside the agent's mission.";
    }
    return reason;
  }

  if (params.runtimeEvent === "policy.block" || params.decision === "BLOCK") {
    if (reason?.toLowerCase().includes("mission")) {
      return "Blocked because this action is outside the agent's mission.";
    }
    return "This action broke one of your protection rules, so Wave stopped it.";
  }

  if (params.runtimeEvent === "policy.review" || params.decision === "REQUIRE_APPROVAL") {
    return "Wave paused this action because your rules require your approval first.";
  }

  if (params.runtimeEvent === "execution.denied") {
    return "The action changed after authorization, so Wave stopped it.";
  }

  if (params.runtimeEvent === "approval.rejected" || params.runtimeEvent === "review.auto_denied") {
    return "This action was not approved, so it did not run.";
  }

  if (params.decision === "ALLOW") {
    return "This action was within your safety rules and was allowed to proceed.";
  }

  return reason || "Wave recorded a safety decision for this action.";
}

export function passportStatusLabel(status: string | null): string {
  switch (status) {
    case "pending_approval":
      return "Waiting for your approval";
    case "active":
      return "Authorized — not yet used";
    case "used":
      return "Used for execution";
    case "revoked":
      return "Revoked";
    case "expired":
      return "Expired";
    default:
      return status ? status.replace(/_/g, " ") : "Not issued";
  }
}

export function hashVerificationLabel(verified: boolean | null): string {
  if (verified === true) return "Action matched the authorized fingerprint";
  if (verified === false) return "The action changed after authorization, so Wave stopped it.";
  return "Not verified yet";
}
