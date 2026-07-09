export type EmailTemplateType =
  | "approval_requested"
  | "approval_approved"
  | "approval_rejected"
  | "critical_risk_detected"
  | "gateway_review_requested";

export type EmailTemplatePayload = {
  approval_requested: {
    approvalId: string;
    title: string;
    severity: string;
    agentId: string;
    requiredApprovals: number;
    slaDeadline: string;
    aiExplanation: string;
    recipientName: string;
  };
  approval_approved: {
    approvalId: string;
    title: string;
    severity: string;
    agentId: string;
    actorName?: string;
    note?: string;
    recipientName: string;
  };
  approval_rejected: {
    approvalId: string;
    title: string;
    severity: string;
    agentId: string;
    actorName?: string;
    note?: string;
    recipientName: string;
  };
  critical_risk_detected: {
    riskAnalysisId: string;
    title: string;
    severity: string;
    overallScore: number;
    explanation: string;
    suggestedAction: string;
    recipientName: string;
  };
  gateway_review_requested: {
    proposalId: string;
    agentId: string;
    toolName: string;
    actionType: string;
    plainEnglishSummary: string;
    riskLevel: string;
    riskScore: number;
    recipientName: string;
  };
};

export interface RenderedEmail {
  subject: string;
  preview: string;
  html: string;
}
