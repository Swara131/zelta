import type { SupportTicketInput } from "@/lib/agents/crm/types";

export function renderTicketResolvedWhatsApp(ticket: SupportTicketInput): string {
  return [
    "✅ Support Ticket Resolved",
    "",
    `Customer: ${ticket.customerName}`,
    `Ticket: ${ticket.ticketId}`,
    "",
    "Resolution:",
    ticket.resolutionDetails,
    "",
    `Satisfaction: ${ticket.satisfactionRating}/5`,
    "",
    "CRM customer record has been updated successfully.",
  ].join("\n");
}
