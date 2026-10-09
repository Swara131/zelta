import type { DemoActionId } from "@/lib/safety-check/demo-action-catalog";

export type SimulatorActionType =
  | "refund"
  | "send_email"
  | "change_account"
  | "delete_customer"
  | "transfer_money";

export interface SimulatorActionOption {
  id: SimulatorActionType;
  label: string;
  description: string;
  actionId: DemoActionId;
  showAmount: boolean;
  defaultAmountInr?: number;
  defaultReason: string;
}

export const SIMULATOR_ACTIONS: SimulatorActionOption[] = [
  {
    id: "refund",
    label: "Refund customer",
    description: "Refund money to a customer account.",
    actionId: "issue_refund",
    showAmount: true,
    defaultAmountInr: 25_000,
    defaultReason: "Customer requested a refund for a delayed shipment.",
  },
  {
    id: "send_email",
    label: "Send email",
    description: "Send a message to a customer inbox.",
    actionId: "send_email",
    showAmount: false,
    defaultReason: "Send order update to customer.",
  },
  {
    id: "change_account",
    label: "Change customer account",
    description: "Modify customer account settings or permissions.",
    actionId: "change_permissions",
    showAmount: false,
    defaultReason: "Update customer account permissions.",
  },
  {
    id: "delete_customer",
    label: "Delete customer",
    description: "Remove customer data from the system.",
    actionId: "delete_record",
    showAmount: false,
    defaultReason: "Remove inactive customer account.",
  },
  {
    id: "transfer_money",
    label: "Transfer money",
    description: "Move funds between accounts.",
    actionId: "transfer_money",
    showAmount: true,
    defaultAmountInr: 100_000,
    defaultReason: "Transfer funds to external account.",
  },
];

export const SIMULATOR_QUICK_SCENARIOS = [
  {
    id: "refund-2k",
    label: "₹2,000 refund",
    hint: "ALLOWED",
    actionType: "refund" as SimulatorActionType,
    amountInr: 2_000,
  },
  {
    id: "refund-25k",
    label: "₹25,000 refund",
    hint: "APPROVAL REQUIRED",
    actionType: "refund" as SimulatorActionType,
    amountInr: 25_000,
  },
  {
    id: "delete-customer",
    label: "Delete customer",
    hint: "BLOCKED",
    actionType: "delete_customer" as SimulatorActionType,
  },
] as const;

export const SIMULATOR_PIPELINE_STEPS = [
  { id: "request", label: "Agent Request" },
  { id: "policy", label: "Policy Check" },
  { id: "risk", label: "Risk Analysis" },
  { id: "approval", label: "Human Approval" },
  { id: "decision", label: "Decision" },
] as const;

export function getSimulatorAction(type: SimulatorActionType): SimulatorActionOption {
  const action = SIMULATOR_ACTIONS.find((item) => item.id === type);
  if (!action) throw new Error("Unknown simulator action.");
  return action;
}

export function formatSimulatorPolicy(decision: "ALLOW" | "REVIEW" | "BLOCK"): string {
  switch (decision) {
    case "ALLOW":
      return "ALLOW";
    case "REVIEW":
      return "REVIEW_REQUIRED";
    case "BLOCK":
      return "BLOCKED";
  }
}

export function formatSimulatorRisk(level: string): string {
  const normalized = level.toLowerCase();
  if (normalized === "critical" || normalized === "high") return "HIGH";
  if (normalized === "medium") return "MEDIUM";
  return "LOW";
}

export function formatSimulatorDecision(decision: "ALLOW" | "REVIEW" | "BLOCK"): string {
  switch (decision) {
    case "ALLOW":
      return "ALLOWED";
    case "REVIEW":
      return "APPROVAL REQUIRED";
    case "BLOCK":
      return "BLOCKED";
  }
}

export function formatActionHeadline(
  action: SimulatorActionOption,
  amountInr: number | null,
  customerName: string
): string {
  switch (action.id) {
    case "refund":
      return `Refund ${amountInr != null ? `₹${amountInr.toLocaleString("en-IN")}` : "—"} to ${customerName}`;
    case "send_email":
      return `Send email to ${customerName}`;
    case "change_account":
      return `Change account for ${customerName}`;
    case "delete_customer":
      return `Delete customer record for ${customerName}`;
    case "transfer_money":
      return `Transfer ${amountInr != null ? `₹${amountInr.toLocaleString("en-IN")}` : "—"} for ${customerName}`;
  }
}
