import type { SupportTicketInput } from "@/lib/agents/crm/types";
import { getWhatsAppContentMode } from "./env";

/** Build ContentVariables for Twilio Content Template Builder (HX…) templates. */
export function buildWhatsAppContentVariables(params: {
  body: string;
  ticket?: SupportTicketInput;
}): Record<string, string> {
  const mode = getWhatsAppContentMode();

  if (mode === "ticket" && params.ticket) {
    return {
      "1": params.ticket.customerName,
      "2": params.ticket.ticketId,
      "3": params.ticket.resolutionDetails,
      "4": String(params.ticket.satisfactionRating),
    };
  }

  // Default: single-variable template — entire message in {{1}}
  return { "1": params.body };
}
