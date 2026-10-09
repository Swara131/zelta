export type DemoDecision = "allowed" | "approval_required" | "blocked";

export interface ZeltaDemoAction {
  id: string;
  label: string;
  decision: DemoDecision;
  decisionEmoji: string;
  decisionLabel: string;
  resultMessage: string;
}

export const ZELTA_DEMO_AGENT_NAME = "Customer Support Agent";

export const ZELTA_DEMO_DISCLAIMER =
  "DEMO DATA — simulated actions only. Not real customer activity.";

export const ZELTA_DEMO_ACTIONS: ZeltaDemoAction[] = [
  {
    id: "demo-1",
    label: "Send refund status email",
    decision: "allowed",
    decisionEmoji: "🟢",
    decisionLabel: "Allowed",
    resultMessage: "Email sent automatically — no approval needed.",
  },
  {
    id: "demo-2",
    label: "Issue ₹2,000 refund",
    decision: "allowed",
    decisionEmoji: "🟢",
    decisionLabel: "Allowed",
    resultMessage: "Refund processed — below your automatic limit.",
  },
  {
    id: "demo-3",
    label: "Issue ₹15,000 refund",
    decision: "approval_required",
    decisionEmoji: "🟡",
    decisionLabel: "Approval required",
    resultMessage: "Paused — waiting for you to approve or reject.",
  },
  {
    id: "demo-4",
    label: "Delete customer database",
    decision: "blocked",
    decisionEmoji: "🔴",
    decisionLabel: "Blocked",
    resultMessage: "Stopped — this action is never allowed.",
  },
];

export function demoDecisionClass(decision: DemoDecision): string {
  switch (decision) {
    case "allowed":
      return "fd-demo-decision-allow";
    case "approval_required":
      return "fd-demo-decision-ask";
    case "blocked":
      return "fd-demo-decision-block";
  }
}
