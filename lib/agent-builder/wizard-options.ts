export const AGENT_TYPE_OPTIONS = [
  { id: "customer-support", label: "Customer Support" },
  { id: "finance", label: "Finance" },
  { id: "sales", label: "Sales" },
  { id: "operations", label: "Operations" },
  { id: "data-analysis", label: "Data Analysis" },
  { id: "custom", label: "Custom" },
] as const;

export type AgentTypeId = (typeof AGENT_TYPE_OPTIONS)[number]["id"];

export const AGENT_CAPABILITY_OPTIONS = [
  { id: "read-customer", label: "Read customer data" },
  { id: "send-email", label: "Send emails" },
  { id: "issue-refund", label: "Issue refunds" },
  { id: "modify-account", label: "Modify customer accounts" },
  { id: "create-order", label: "Create orders" },
  { id: "delete-record", label: "Delete records" },
  { id: "transfer-money", label: "Transfer money" },
] as const;

export type AgentCapabilityId = (typeof AGENT_CAPABILITY_OPTIONS)[number]["id"];

export const WIZARD_STEPS = [
  { id: 1, label: "Agent details" },
  { id: 2, label: "Capabilities" },
  { id: 3, label: "Protection rules" },
  { id: 4, label: "Connect agent" },
  { id: 5, label: "Test" },
  { id: 6, label: "Activate" },
] as const;

export function buildWizardDescription(params: {
  name: string;
  purpose: string;
  agentType: AgentTypeId;
  capabilities: AgentCapabilityId[];
}): string {
  const typeLabel =
    AGENT_TYPE_OPTIONS.find((t) => t.id === params.agentType)?.label ?? "Custom";
  const capabilityLabels = params.capabilities
    .map((id) => AGENT_CAPABILITY_OPTIONS.find((c) => c.id === id)?.label)
    .filter(Boolean);

  const parts = [
    `Agent name: ${params.name.trim()}.`,
    `Type: ${typeLabel}.`,
    `Purpose: ${params.purpose.trim()}.`,
  ];

  if (capabilityLabels.length > 0) {
    parts.push(`Capabilities: ${capabilityLabels.join(", ")}.`);
  }

  parts.push(
    "Apply sensible protection: allow low-risk reads and emails, require approval for large refunds and account changes, always block deletes and unauthorized transfers."
  );

  return parts.join(" ");
}

export const WIZARD_TEST_SCENARIOS = [
  {
    id: "refund-2k",
    label: "Refund ₹2,000",
    actionId: "issue_refund" as const,
    amountInr: 2_000,
  },
  {
    id: "refund-25k",
    label: "Refund ₹25,000",
    actionId: "issue_refund" as const,
    amountInr: 25_000,
  },
  {
    id: "delete-customer",
    label: "Delete customer",
    actionId: "delete_record" as const,
  },
] as const;
