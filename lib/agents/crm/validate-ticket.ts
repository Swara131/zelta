import type { SupportTicketInput } from "./types";

export function validateSupportTicketInput(
  input: Partial<SupportTicketInput>
): { valid: true; ticket: SupportTicketInput } | { valid: false; error: string } {
  const ticketId = input.ticketId?.trim();
  const customerId = input.customerId?.trim();
  const customerName = input.customerName?.trim();
  const resolutionDetails = input.resolutionDetails?.trim();
  const rating = input.satisfactionRating;

  if (!ticketId) return { valid: false, error: "Support ticket ID is required." };
  if (!customerId) return { valid: false, error: "Customer ID is required." };
  if (!customerName) return { valid: false, error: "Customer name is required." };
  if (!resolutionDetails || resolutionDetails.length < 5) {
    return { valid: false, error: "Resolution details are required (at least 5 characters)." };
  }
  if (
    typeof rating !== "number" ||
    !Number.isInteger(rating) ||
    rating < 1 ||
    rating > 5
  ) {
    return { valid: false, error: "Satisfaction rating must be an integer from 1 to 5." };
  }

  return {
    valid: true,
    ticket: {
      ticketId,
      customerId,
      customerName,
      resolutionDetails,
      satisfactionRating: rating,
    },
  };
}

export const DEFAULT_SUPPORT_TICKET: SupportTicketInput = {
  ticketId: "TKT-1042",
  customerId: "cus_demo_001",
  customerName: "Jane Doe",
  resolutionDetails: "Account access restored and billing question answered.",
  satisfactionRating: 5,
};
