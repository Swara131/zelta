import type { DemoActionId } from "@/lib/safety-check/demo-action-catalog";

export interface AgentQuickTestPreset {
  id: string;
  label: string;
  actionId: DemoActionId;
  amountInr?: number;
  reason?: string;
}

export const AGENT_QUICK_TEST_PRESETS: AgentQuickTestPreset[] = [
  {
    id: "check-refund-status",
    label: "Check customer refund status",
    actionId: "send_email",
    reason: "Check refund status for order ORD-8821",
  },
  {
    id: "send-email",
    label: "Send customer email",
    actionId: "send_email",
    reason: "Send order update to customer",
  },
  {
    id: "refund-2k",
    label: "Refund ₹2,000",
    actionId: "issue_refund",
    amountInr: 2_000,
    reason: "Customer requested a refund for a cancelled order",
  },
  {
    id: "refund-25k",
    label: "Refund ₹25,000",
    actionId: "issue_refund",
    amountInr: 25_000,
    reason: "Customer requested a refund for a delayed shipment",
  },
  {
    id: "delete-record",
    label: "Delete customer record",
    actionId: "delete_record",
    reason: "Remove inactive customer account",
  },
];
