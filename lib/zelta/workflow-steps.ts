export const ZELTA_WORKFLOW_STEPS = [
  {
    id: "agent",
    title: "AI Agent",
    detail: "I want to refund ₹25,000",
    quote: true,
  },
  {
    id: "gateway",
    title: "Wave Gateway",
    detail: null,
  },
  {
    id: "policy",
    title: "Policy Check",
    detail: "Refunds above ₹5,000 require approval",
    quote: true,
  },
  {
    id: "risk",
    title: "Risk Analysis",
    detail: "High risk — 82%",
    quote: true,
  },
  {
    id: "approval",
    title: "Human Approval",
    detail: "Approve or block",
    quote: true,
  },
  {
    id: "token",
    title: "Execution Token",
    detail: "Short-lived authorization",
    quote: true,
  },
  {
    id: "action",
    title: "Action",
    detail: "Refund executed",
    quote: true,
    final: true,
  },
] as const;

export type ZeltaWorkflowStep = (typeof ZELTA_WORKFLOW_STEPS)[number];
