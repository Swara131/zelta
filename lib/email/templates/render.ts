import { getAppUrl } from "../env";
import type { EmailTemplatePayload, RenderedEmail } from "../types";
import {
  detailRow,
  emailLayout,
  escapeHtml,
  paragraph,
  severityBadge,
} from "./layout";

export function renderApprovalRequested(
  data: EmailTemplatePayload["approval_requested"]
): RenderedEmail {
  const subject = `[Action Required] Approval needed — ${data.title}`;
  const preview = `${data.severity.toUpperCase()} risk · ${data.requiredApprovals} approval(s) required`;

  const bodyHtml = `
    ${paragraph(`Hi ${data.recipientName}, an agent action requires your review before it can proceed.`)}
    <p style="margin:0 0 20px;">${severityBadge(data.severity)}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
      ${detailRow("Action", data.title)}
      ${detailRow("Agent", data.agentId)}
      ${detailRow("Approvals required", String(data.requiredApprovals))}
      ${detailRow("SLA deadline", new Date(data.slaDeadline).toLocaleString())}
    </table>
    ${paragraph(data.aiExplanation)}
  `;

  const html = emailLayout({
    preheader: preview,
    title: "Approval Requested",
    bodyHtml,
    ctaLabel: "Review in ApprovalLayer",
    ctaHref: `${getAppUrl()}/approvals`,
    accentColor: "#6366f1",
  });

  return { subject, preview, html };
}

export function renderApprovalApproved(
  data: EmailTemplatePayload["approval_approved"]
): RenderedEmail {
  const subject = `[Approved] ${data.title}`;
  const preview = `Agent action approved${data.actorName ? ` by ${data.actorName}` : ""}`;

  const bodyHtml = `
    ${paragraph(`Hi ${data.recipientName}, the following agent action has been approved and may proceed.`)}
    <p style="margin:0 0 20px;">${severityBadge(data.severity)}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
      ${detailRow("Action", data.title)}
      ${detailRow("Agent", data.agentId)}
      ${data.actorName ? detailRow("Approved by", data.actorName) : ""}
      ${data.note ? detailRow("Note", data.note) : ""}
    </table>
  `;

  const html = emailLayout({
    preheader: preview,
    title: "Approval Granted",
    bodyHtml,
    ctaLabel: "View Approvals",
    ctaHref: `${getAppUrl()}/approvals`,
    accentColor: "#22c55e",
  });

  return { subject, preview, html };
}

export function renderApprovalRejected(
  data: EmailTemplatePayload["approval_rejected"]
): RenderedEmail {
  const subject = `[Rejected] ${data.title}`;
  const preview = `Agent action was rejected${data.actorName ? ` by ${data.actorName}` : ""}`;

  const bodyHtml = `
    ${paragraph(`Hi ${data.recipientName}, the following agent action was rejected and will not proceed.`)}
    <p style="margin:0 0 20px;">${severityBadge(data.severity)}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
      ${detailRow("Action", data.title)}
      ${detailRow("Agent", data.agentId)}
      ${data.actorName ? detailRow("Rejected by", data.actorName) : ""}
      ${data.note ? detailRow("Reason", data.note) : ""}
    </table>
  `;

  const html = emailLayout({
    preheader: preview,
    title: "Approval Rejected",
    bodyHtml,
    ctaLabel: "View Details",
    ctaHref: `${getAppUrl()}/approvals`,
    accentColor: "#ef4444",
  });

  return { subject, preview, html };
}

export function renderCriticalRiskDetected(
  data: EmailTemplatePayload["critical_risk_detected"]
): RenderedEmail {
  const subject = `[CRITICAL] Risk detected — ${data.title}`;
  const preview = `Risk score ${data.overallScore}/100 · immediate review recommended`;

  const bodyHtml = `
    ${paragraph(`Hi ${data.recipientName}, ApprovalLayer detected a critical security risk in your latest log analysis.`)}
    <p style="margin:0 0 20px;">${severityBadge("critical")}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
      ${detailRow("Risk", data.title)}
      ${detailRow("Overall score", `${data.overallScore}/100`)}
    </table>
    ${paragraph(data.explanation)}
    ${paragraph(`Recommended action: ${data.suggestedAction}`)}
  `;

  const html = emailLayout({
    preheader: preview,
    title: "Critical Risk Detected",
    bodyHtml,
    ctaLabel: "Open Risk Analysis",
    ctaHref: `${getAppUrl()}/risk`,
    accentColor: "#ef4444",
  });

  return { subject, preview, html };
}

export function renderGatewayReviewRequested(
  data: EmailTemplatePayload["gateway_review_requested"]
): RenderedEmail {
  const subject = `[Review Required] ${data.toolName} — ${data.agentId}`;
  const preview = `${data.riskLevel.toUpperCase()} risk · review by ${new Date(data.reviewDeadline).toLocaleString()}`;

  const reasonsHtml =
    data.riskReasons.length > 0
      ? `<ul style="margin:0 0 20px;padding-left:20px;color:#a1a1aa;font-size:14px;line-height:1.6;">
          ${data.riskReasons.map((reason) => `<li style="margin-bottom:6px;">${escapeHtml(reason)}</li>`).join("")}
        </ul>`
      : "";

  const bodyHtml = `
    ${paragraph(`Hi ${data.recipientName}, an agent action requires your review before it can proceed.`)}
    <p style="margin:0 0 20px;">${severityBadge(data.riskLevel)}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
      ${detailRow("Agent", data.agentId)}
      ${detailRow("Action type", data.actionType)}
      ${detailRow("Tool", data.toolName)}
      ${detailRow("Risk level", data.riskLevel.toUpperCase())}
      ${detailRow("Review deadline", new Date(data.reviewDeadline).toLocaleString())}
    </table>
    ${paragraph(data.plainEnglishSummary)}
    ${reasonsHtml ? `<p style="margin:0 0 8px;font-size:13px;color:#71717a;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Risk signals</p>${reasonsHtml}` : ""}
  `;

  const html = emailLayout({
    preheader: preview,
    title: "Gateway Review Required",
    bodyHtml,
    ctaLabel: "Review in ApprovalLayer",
    ctaHref: data.approvalsUrl,
    accentColor: "#6366f1",
  });

  return { subject, preview, html };
}

export function renderEmailTemplate<T extends import("../types").EmailTemplateType>(
  type: T,
  payload: import("../types").EmailTemplatePayload[T]
): RenderedEmail {
  switch (type) {
    case "approval_requested":
      return renderApprovalRequested(
        payload as EmailTemplatePayload["approval_requested"]
      );
    case "approval_approved":
      return renderApprovalApproved(payload as EmailTemplatePayload["approval_approved"]);
    case "approval_rejected":
      return renderApprovalRejected(payload as EmailTemplatePayload["approval_rejected"]);
    case "critical_risk_detected":
      return renderCriticalRiskDetected(
        payload as EmailTemplatePayload["critical_risk_detected"]
      );
    case "gateway_review_requested":
      return renderGatewayReviewRequested(
        payload as EmailTemplatePayload["gateway_review_requested"]
      );
    default:
      throw new Error(`Unknown email template: ${type}`);
  }
}
