import type { PendingApproval } from "@/lib/approval-types";
import type { RiskScoreBreakdownView } from "@/lib/approvals/risk-score-breakdown";
import { buildRiskScoreBreakdownFromApproval } from "@/lib/approvals/risk-score-breakdown";
import type { RiskSeverity } from "@/lib/risk-types";
import { formatRelativeTime } from "@/lib/audit/activity-copy";
import {
  describeApprovalHeadline,
  describeApprovalReason,
  humanizeAgentLabel,
} from "@/lib/dashboard/founder-copy";

export interface ActionReviewView {
  id: string;
  categoryLabel: string;
  agentName: string;
  actionIntent: string;
  actionWants: string;
  headline: string;
  customer: string | null;
  customerId: string | null;
  resourceAffected: string | null;
  amount: string | null;
  reason: string | null;
  whyPaused: string;
  whyApprovalRequired: string;
  riskLabel: string;
  riskScoreDisplay: string | null;
  riskScoreExplanation: string | null;
  riskScoreBreakdown: RiskScoreBreakdownView | null;
  policySummary: string;
  protectionLabel: string;
  statusLabel: string;
  timeWaiting: string;
  requestedAt: string;
  expiresAt: string;
  policyResult: string;
  riskResult: string;
  agentSummary: string;
  actionDetails: string;
  approveOutcome: string;
  rejectOutcome: string;
}

export interface ActionReviewDetailField {
  label: string;
  value: string;
}

export interface ActionReviewDetailSection {
  title: string;
  body: string;
}

function formatMoney(amount: unknown, currency?: unknown): string | null {
  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    return null;
  }

  const code = typeof currency === "string" ? currency.toUpperCase() : "INR";
  const major =
    code === "INR" && amount >= 100 ? amount / 100 : amount >= 10000 ? amount / 100 : amount;

  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
      maximumFractionDigits: 0,
    }).format(major);
  } catch {
    return `${code} ${major.toLocaleString()}`;
  }
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function describeActionCategoryLabel(approval: PendingApproval): string {
  const tool = (approval.toolName ?? "").toLowerCase();
  const action = (approval.actionType ?? "").toLowerCase();

  if (tool.includes("refund") || action.includes("refund")) {
    return "REFUND REQUEST";
  }
  if (tool.includes("delete") || action.includes("delete")) {
    return "DELETE REQUEST";
  }
  if (tool.includes("export") || action.includes("export")) {
    return "DATA EXPORT REQUEST";
  }
  if (tool.includes("email") || action.includes("email") || action.includes("notify")) {
    return "EMAIL REQUEST";
  }
  if (tool.includes("transfer") || action.includes("transfer")) {
    return "TRANSFER REQUEST";
  }
  if (tool.includes("discount") || action.includes("discount")) {
    return "DISCOUNT REQUEST";
  }
  if (tool.includes("permission") || action.includes("permission")) {
    return "PERMISSION CHANGE";
  }

  return "ACTION REQUEST";
}

export function describePolicySummary(approval: PendingApproval): string {
  const reviewPolicy = approval.matchedPolicies?.find(
    (policy) => policy.decision === "REVIEW"
  );

  if (reviewPolicy?.name?.toLowerCase().includes("refund")) {
    return "Refunds above ₹5,000 require approval";
  }

  if (reviewPolicy?.reason?.toLowerCase().includes("5000")) {
    return "Refunds above ₹5,000 require approval";
  }

  if (reviewPolicy?.name?.toLowerCase().includes("export")) {
    return "Large data exports require approval";
  }

  if (reviewPolicy?.name?.trim()) {
    return reviewPolicy.name.trim();
  }

  return "This action requires human approval before it can run";
}

function describeDisplayRiskLabel(approval: PendingApproval): string {
  const payload = approval.actionPayload ?? {};
  const tool = (approval.toolName ?? "").toLowerCase();
  const action = (approval.actionType ?? "").toLowerCase();

  if (tool.includes("refund") || action.includes("refund")) {
    const amountRaw = typeof payload.amount === "number" ? payload.amount : null;
    const major =
      amountRaw && String(payload.currency ?? "INR").toUpperCase() === "INR" && amountRaw >= 100
        ? amountRaw / 100
        : amountRaw;

    if (major && major > 5_000) {
      return "High";
    }
  }

  if (approval.riskSeverity === "critical" || approval.riskSeverity === "high") {
    return "High";
  }

  return riskLabelFor(approval.riskSeverity);
}

export const APPROVE_OUTCOME_COPY =
  "Wave will authorize the agent to complete this action. It can only proceed after you approve.";

export const REJECT_OUTCOME_COPY =
  "The action will not run. Wave prevents the agent from completing this request.";

export const APPROVE_SUCCESS_COPY =
  "Approved — action is now authorized by Wave.";

export const REJECT_SUCCESS_COPY = "Rejected — action was prevented.";

function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function extractCustomer(payload: Record<string, unknown>): string | null {
  for (const key of ["customerName", "customer_name", "customerFullName", "name"]) {
    const value = payload[key];
    if (typeof value === "string" && value.trim() && !value.startsWith("cus_")) {
      return value.trim();
    }
  }
  return null;
}

function extractCustomerId(payload: Record<string, unknown>): string | null {
  for (const key of ["customerId", "customer_id", "userId", "user_id", "accountId"]) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  for (const key of ["customerName", "customer_name", "name"]) {
    const value = payload[key];
    if (typeof value === "string" && value.trim() && /^cus[_-]/i.test(value.trim())) {
      return value.trim();
    }
  }

  return null;
}

function extractResourceAffected(
  approval: PendingApproval,
  payload: Record<string, unknown>
): string | null {
  const customer = extractCustomer(payload);
  if (customer) {
    return customer;
  }

  if (typeof payload.databaseName === "string" && payload.databaseName.trim()) {
    return payload.databaseName.trim();
  }

  if (typeof payload.resourceType === "string" && payload.resourceType.trim()) {
    return payload.resourceType.trim();
  }

  const tool = (approval.toolName ?? "").toLowerCase();
  if (tool.includes("export")) {
    return "Customer records";
  }

  return null;
}

function extractAmountLabel(payload: Record<string, unknown>): string | null {
  return formatMoney(payload.amount, payload.currency);
}

function extractReason(approval: PendingApproval): string | null {
  const payload = approval.actionPayload ?? {};

  for (const key of ["reason", "justification", "note", "description", "businessReason"]) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  const summary = approval.aiExplanation?.trim();
  if (
    summary &&
    !summary.toLowerCase().includes("awaiting ai") &&
    !summary.toLowerCase().includes("policy engine")
  ) {
    return summary;
  }

  return approval.businessJustification?.trim() || null;
}

export function describeActionSummary(approval: PendingApproval): string {
  const tool = (approval.toolName ?? "").toLowerCase();
  const action = (approval.actionType ?? "").toLowerCase();

  if (tool.includes("refund") || action.includes("refund")) {
    return "issue a refund";
  }
  if (tool.includes("delete") || action.includes("delete")) {
    return "delete data";
  }
  if (tool.includes("export") || action.includes("export")) {
    return "export customer data";
  }
  if (tool.includes("email") || action.includes("email") || action.includes("notify")) {
    return "send a customer email";
  }

  const intent = describeActionIntent(approval);
  return intent.charAt(0).toLowerCase() + intent.slice(1);
}

export function describeActionIntent(approval: PendingApproval): string {
  const payload = approval.actionPayload ?? {};
  const tool = (approval.toolName ?? "").toLowerCase();
  const action = (approval.actionType ?? "").toLowerCase();

  if (tool.includes("refund") || action.includes("refund")) {
    const amount = formatMoney(payload.amount, payload.currency);
    return amount ? `Issue a ${amount} refund` : "Issue a refund";
  }

  if (tool.includes("delete") || action.includes("delete")) {
    const customerId =
      typeof payload.customerId === "string"
        ? payload.customerId
        : typeof payload.customer_id === "string"
          ? payload.customer_id
          : null;
    return customerId ? `Delete customer record ${customerId}` : "Delete customer record";
  }

  if (tool.includes("export") || action.includes("export")) {
    return "Export customer data";
  }

  if (tool.includes("email") || action.includes("email") || action.includes("notify")) {
    return "Send an email to a customer";
  }

  const headline = describeApprovalHeadline(approval);
  const agentName = humanizeAgentLabel(approval.agentId);
  const prefix = `${agentName} wants to `;
  if (headline.toLowerCase().startsWith(prefix.toLowerCase())) {
    const intent = headline.slice(prefix.length).trim();
    return intent.charAt(0).toUpperCase() + intent.slice(1);
  }

  return headline;
}

export function describeActionWants(approval: PendingApproval): string {
  const payload = approval.actionPayload ?? {};
  const tool = (approval.toolName ?? "").toLowerCase();
  const action = (approval.actionType ?? "").toLowerCase();

  if (tool.includes("refund") || action.includes("refund")) {
    const amount = formatMoney(payload.amount, payload.currency);
    return amount ? `Wants to refund ${amount}` : "Wants to issue a refund";
  }

  if (tool.includes("delete") || action.includes("delete")) {
    const target =
      typeof payload.databaseName === "string"
        ? payload.databaseName
        : "production data";
    return `Wants to delete ${target}`;
  }

  if (tool.includes("export") || action.includes("export")) {
    return "Wants to export customer data";
  }

  if (tool.includes("email") || action.includes("email") || action.includes("notify")) {
    return "Wants to send a customer email";
  }

  const intent = describeActionIntent(approval);
  return `Wants to ${intent.charAt(0).toLowerCase()}${intent.slice(1)}`;
}

export function describeWhyApprovalRequired(approval: PendingApproval): string {
  const payload = approval.actionPayload ?? {};
  const tool = (approval.toolName ?? "").toLowerCase();
  const action = (approval.actionType ?? "").toLowerCase();
  const reviewPolicy = approval.matchedPolicies?.find(
    (policy) => policy.decision === "REVIEW"
  );

  if (tool.includes("refund") || action.includes("refund")) {
    const amountRaw = typeof payload.amount === "number" ? payload.amount : null;
    const major =
      amountRaw && String(payload.currency ?? "INR").toUpperCase() === "INR" && amountRaw >= 100
        ? amountRaw / 100
        : amountRaw;

    if (major && major > 5_000) {
      return "Your policy requires approval for refunds above ₹5,000.";
    }

    if (reviewPolicy) {
      return "Your policy requires approval for refunds above ₹5,000.";
    }
  }

  if (reviewPolicy?.name?.toLowerCase().includes("export")) {
    return "Your policy requires approval before exporting large amounts of customer data.";
  }

  if (reviewPolicy?.name?.toLowerCase().includes("delete")) {
    return "Your policy blocks destructive actions without human review.";
  }

  const why = describeWhyPaused(approval);
  if (why.endsWith(".")) {
    return why;
  }
  return `${why}.`;
}

export function describeWhyPaused(approval: PendingApproval): string {
  const payload = approval.actionPayload ?? {};
  const tool = (approval.toolName ?? "").toLowerCase();
  const action = (approval.actionType ?? "").toLowerCase();
  const reviewPolicy = approval.matchedPolicies?.find(
    (policy) => policy.decision === "REVIEW"
  );

  if (tool.includes("refund") || action.includes("refund")) {
    const amountRaw = typeof payload.amount === "number" ? payload.amount : null;
    const major =
      amountRaw && String(payload.currency ?? "INR").toUpperCase() === "INR" && amountRaw >= 100
        ? amountRaw / 100
        : amountRaw;

    if (major && major > 5_000) {
      return "This refund is above your automatic limit of ₹5,000.";
    }

    if (reviewPolicy?.reason?.toLowerCase().includes("5000")) {
      return "This refund is above your automatic limit of ₹5,000.";
    }
  }

  if (reviewPolicy?.reason?.trim()) {
    const reason = reviewPolicy.reason.trim();
    if (reason.toLowerCase().includes("5000 inr")) {
      return "This refund is above your automatic limit of ₹5,000.";
    }
    if (!reason.toLowerCase().includes("policy engine")) {
      return reason.endsWith(".") ? reason : `${reason}.`;
    }
  }

  if (reviewPolicy?.name?.trim()) {
    const name = reviewPolicy.name.trim();
    if (name.toLowerCase().includes("large") && name.toLowerCase().includes("refund")) {
      return "This refund is above your automatic limit of ₹5,000.";
    }
    return `${name}.`;
  }

  const fallback = describeApprovalReason(approval);
  if (fallback.toLowerCase().includes("policy engine")) {
    return "This action needs your approval before it can continue.";
  }

  return fallback.endsWith(".") ? fallback : `${fallback}.`;
}

function describePolicyResult(approval: PendingApproval): string {
  const decision = approval.gatewayDecision ?? "REVIEW";
  const matched =
    approval.matchedPolicies?.find((policy) => policy.decision === decision) ??
    approval.matchedPolicies?.[0];

  switch (decision) {
    case "ALLOW":
      return matched
        ? `Allowed automatically — ${matched.name}`
        : "Allowed automatically";
    case "BLOCK":
      return matched ? `Blocked — ${matched.name}` : "Blocked — not allowed";
    default:
      return matched
        ? `Require approval — ${matched.name}`
        : "Require approval before continuing";
  }
}

function describeRiskResult(approval: PendingApproval): string {
  const level = riskLabelFor(approval.riskSeverity);

  if (approval.aiRiskReasons?.length) {
    return `${level} — ${approval.aiRiskReasons.slice(0, 2).join(". ")}`;
  }

  if (approval.shadowRisk?.reasons?.length) {
    return `${level} — ${approval.shadowRisk.reasons.slice(0, 2).join(". ")}`;
  }

  return `${level} risk level for this action`;
}

function describeActionDetails(approval: PendingApproval): string {
  const payload = approval.actionPayload ?? {};
  const parts: string[] = [];

  const amount = extractAmountLabel(payload);
  if (amount) {
    parts.push(`Amount: ${amount}`);
  }

  const customer = extractCustomer(payload);
  if (customer) {
    parts.push(`Customer: ${customer}`);
  }

  const reason = extractReason(approval);
  if (reason) {
    parts.push(`Reason: ${reason}`);
  }

  if (approval.toolName) {
    parts.push(`Tool: ${approval.toolName.replace(/_/g, " ")}`);
  }

  if (parts.length === 0 && approval.aiExplanation?.trim()) {
    return approval.aiExplanation.trim();
  }

  return parts.join(" · ");
}

export function buildActionReviewDetailFields(
  approval: PendingApproval
): ActionReviewDetailField[] {
  const view = buildActionReviewView(approval);
  const target =
    view.customerId ??
    view.customer ??
    view.resourceAffected ??
    "Not specified";

  return [
    { label: "Agent", value: view.agentName },
    { label: "Requested action", value: view.actionIntent },
    { label: "Target", value: target },
    { label: "Amount / value", value: view.amount ?? "Not applicable" },
    { label: "Reason", value: view.reason ?? "Not provided" },
    { label: "Policy result", value: view.policyResult },
    { label: "Risk result", value: view.riskResult },
    { label: "Why approval is required", value: view.whyApprovalRequired },
    { label: "Requested time", value: view.requestedAt },
    { label: "Expiration time", value: view.expiresAt },
  ];
}

export function buildActionReviewDetailSections(
  approval: PendingApproval
): ActionReviewDetailSection[] {
  const view = buildActionReviewView(approval);

  return [
    { title: "What the agent wants to do", body: view.actionWants },
    { title: "Why Wave flagged it", body: view.whyApprovalRequired },
    { title: "Policy result", body: view.policyResult },
    { title: "Risk result", body: view.riskResult },
    { title: "Agent information", body: view.agentSummary },
    { title: "Action details", body: view.actionDetails || view.actionIntent },
  ];
}

function protectionLabelFor(approval: PendingApproval): string {
  switch (approval.gatewayDecision) {
    case "BLOCK":
      return "Blocked by protection rules";
    case "ALLOW":
      return "Allowed automatically";
    default:
      return "Human approval required";
  }
}

function riskLabelFor(severity: RiskSeverity): string {
  return capitalize(severity);
}

export function buildApprovalRiskTransparency(approval: PendingApproval): {
  riskScoreDisplay: string | null;
  riskScoreExplanation: string | null;
  riskScoreBreakdown: RiskScoreBreakdownView | null;
} {
  const breakdown = buildRiskScoreBreakdownFromApproval(approval);

  if (!breakdown) {
    return {
      riskScoreDisplay: null,
      riskScoreExplanation: null,
      riskScoreBreakdown: null,
    };
  }

  const riskScoreDisplay = `Risk Score: ${breakdown.scoreDisplay}`;
  const riskScoreExplanation =
    breakdown.summaryReason ??
    breakdown.factors[0]?.label ??
    describeWhyApprovalRequired(approval);

  return {
    riskScoreDisplay,
    riskScoreExplanation,
    riskScoreBreakdown: breakdown,
  };
}

export function buildActionReviewView(approval: PendingApproval): ActionReviewView {
  const payload = approval.actionPayload ?? {};
  const agentName = humanizeAgentLabel(approval.agentId);
  const actionIntent = describeActionIntent(approval);
  const { riskScoreDisplay, riskScoreExplanation, riskScoreBreakdown } =
    buildApprovalRiskTransparency(approval);

  return {
    id: approval.id,
    categoryLabel: describeActionCategoryLabel(approval),
    agentName,
    actionIntent,
    actionWants: describeActionWants(approval),
    headline: `${agentName} wants to ${describeActionSummary(approval)}`,
    customer: extractCustomer(payload),
    customerId: extractCustomerId(payload),
    resourceAffected: extractResourceAffected(approval, payload),
    amount: extractAmountLabel(payload),
    reason: extractReason(approval),
    whyPaused: describeWhyPaused(approval),
    whyApprovalRequired: describeWhyApprovalRequired(approval),
    riskLabel: describeDisplayRiskLabel(approval),
    riskScoreDisplay,
    riskScoreExplanation,
    riskScoreBreakdown,
    policySummary: describePolicySummary(approval),
    protectionLabel: protectionLabelFor(approval),
    statusLabel: "Waiting for your decision",
    timeWaiting: formatRelativeTime(approval.submittedAt),
    requestedAt: formatTimestamp(approval.submittedAt),
    expiresAt: approval.slaDeadline
      ? formatTimestamp(approval.slaDeadline)
      : "No expiration set",
    policyResult: describePolicyResult(approval),
    riskResult: describeRiskResult(approval),
    agentSummary: `${agentName} · Connected agent`,
    actionDetails: describeActionDetails(approval),
    approveOutcome: APPROVE_OUTCOME_COPY,
    rejectOutcome: REJECT_OUTCOME_COPY,
  };
}
