import { insertCrmUpdate } from "@/lib/agents/crm/repository";
import { validateSupportTicketInput } from "@/lib/agents/crm/validate-ticket";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ToolExecutionOutcome, ToolHandlerContext } from "../../runtime/types";

export async function handleUpdateCrmRecord(
  input: Record<string, unknown>,
  context: ToolHandlerContext
): Promise<ToolExecutionOutcome> {
  const ticketId =
    (typeof input.ticketId === "string" && input.ticketId.trim()) ||
    (typeof input.ticket_id === "string" && input.ticket_id.trim()) ||
    undefined;

  const validation = validateSupportTicketInput({
    ticketId,
    customerId:
      (typeof input.customerId === "string" && input.customerId) ||
      (typeof input.customer_id === "string" && input.customer_id) ||
      undefined,
    customerName:
      (typeof input.customerName === "string" && input.customerName) ||
      (typeof input.customer_name === "string" && input.customer_name) ||
      undefined,
    resolutionDetails:
      (typeof input.resolutionDetails === "string" && input.resolutionDetails) ||
      (typeof input.resolution_details === "string" && input.resolution_details) ||
      (typeof input.value === "string" && input.field === "resolution" ? input.value : undefined) ||
      (typeof input.notes === "string" && input.notes) ||
      undefined,
    satisfactionRating:
      typeof input.satisfactionRating === "number"
        ? input.satisfactionRating
        : typeof input.satisfaction_rating === "number"
          ? input.satisfaction_rating
          : typeof input.rating === "number"
            ? input.rating
            : undefined,
  });

  if (!validation.valid) {
    return {
      executed: false,
      error: validation.error,
      output: { receivedInput: input },
    };
  }

  try {
    const admin = createAdminClient();
    const row = await insertCrmUpdate(admin, {
      agentId: context.agent.record.id,
      organizationId: context.agent.record.organizationId,
      userId: context.userId,
      agentRunId: context.runId ?? null,
      ticket: validation.ticket,
    });

    return {
      executed: true,
      output: {
        updateId: row.id,
        ticketId: row.ticketId,
        customerId: row.customerId,
        customerName: row.customerName,
        resolutionDetails: row.resolutionDetails,
        satisfactionRating: row.satisfactionRating,
        updatedAt: row.createdAt,
      },
    };
  } catch (err) {
    return {
      executed: false,
      error: err instanceof Error ? err.message : "CRM update failed.",
      output: { ticketId: validation.ticket.ticketId },
    };
  }
}
