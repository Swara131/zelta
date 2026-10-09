import type { ProposeActionInput } from "@/lib/gateway/proposals/types";

export type TestActionDecision = "ALLOW" | "REVIEW" | "BLOCK";

export interface AgentTestAction {
  id: string;
  label: string;
  description: string;
  expectedDecision: TestActionDecision;
  propose: ProposeActionInput;
}

/** Realistic examples that exercise Wave's built-in demo protection policies. */
export function buildAgentTestActions(agentId: string): AgentTestAction[] {
  return [
    {
      id: "allow-small-refund",
      label: "Issue ₹500 refund",
      description: "Below the automatic approval limit — should be allowed.",
      expectedDecision: "ALLOW",
      propose: {
        agentId,
        toolName: "issue_refund",
        actionType: "financial.refund",
        payload: {
          customerId: "cus_demo_allow",
          amount: 50_000,
          currency: "INR",
        },
      },
    },
    {
      id: "review-large-refund",
      label: "Issue ₹500,000 refund",
      description: "Above the automatic limit — Wave should ask for approval.",
      expectedDecision: "REVIEW",
      propose: {
        agentId,
        toolName: "issue_refund",
        actionType: "financial.refund",
        payload: {
          customerId: "cus_demo_review",
          amount: 50_000_000,
          currency: "INR",
        },
      },
    },
    {
      id: "block-prod-delete",
      label: "Delete production database",
      description: "Destructive production action — Wave should block it.",
      expectedDecision: "BLOCK",
      propose: {
        agentId,
        toolName: "delete_database",
        actionType: "database.delete",
        payload: {
          resourceType: "database",
          environment: "production",
          destructiveOperation: true,
          productionTarget: true,
          databaseName: "demo-prod-db",
        },
      },
    },
  ];
}

export function decisionLabel(decision: TestActionDecision | string): string {
  switch (decision) {
    case "ALLOW":
      return "Allowed";
    case "REVIEW":
      return "Review required";
    case "BLOCK":
      return "Blocked";
    default:
      return decision;
  }
}

export function decisionTone(decision: string): "allow" | "review" | "block" | "neutral" {
  switch (decision) {
    case "ALLOW":
    case "allowed":
      return "allow";
    case "REVIEW":
    case "review_required":
      return "review";
    case "BLOCK":
    case "blocked":
      return "block";
    default:
      return "neutral";
  }
}
