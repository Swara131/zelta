/** Human-readable labels for agent tool / action identifiers stored in the database. */

const TOOL_LABELS: Record<string, string> = {
  send_email: "Send email",
  send_whatsapp_message: "Send WhatsApp message",
  issue_refund: "Issue refund",
  update_crm_record: "Update CRM record",
  query_database: "Query database",
  create_calendar_event: "Create calendar event",
  read_customer: "Read customer data",
  modify_account: "Modify customer account",
  delete_record: "Delete records",
  transfer_money: "Transfer money",
  create_order: "Create order",
};

export function labelAgentTool(toolId: string): string {
  const normalized = toolId.trim().toLowerCase();
  if (TOOL_LABELS[normalized]) return TOOL_LABELS[normalized];

  return normalized
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function labelAgentTools(tools: string[]): Array<{ id: string; label: string }> {
  return tools.map((id) => ({ id, label: labelAgentTool(id) }));
}

const TRIGGER_LABELS: Record<string, string> = {
  email: "Email trigger",
  webhook: "Webhook trigger",
  schedule: "Scheduled trigger",
};

export function labelTriggerType(triggerType: string): string {
  return TRIGGER_LABELS[triggerType] ?? labelAgentTool(triggerType);
}
