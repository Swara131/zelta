import { deleteCrmCustomer } from "@/lib/agents/crm/repository";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ToolExecutionOutcome, ToolHandlerContext } from "../../runtime/types";

export async function handleDeleteCrmRecord(
  input: Record<string, unknown>,
  context: ToolHandlerContext
): Promise<ToolExecutionOutcome> {
  const customerId =
    (typeof input.customerId === "string" && input.customerId.trim()) ||
    (typeof input.customer_id === "string" && input.customer_id.trim()) ||
    "";

  if (!customerId) {
    return {
      executed: false,
      error: "A customer ID is required to delete a CRM record.",
      output: { receivedInput: input },
    };
  }

  try {
    const admin = createAdminClient();
    const { deletedCount } = await deleteCrmCustomer(admin, {
      agentId: context.agent.record.id,
      organizationId: context.agent.record.organizationId,
      customerId,
    });

    return {
      executed: true,
      output: {
        deleted: deletedCount > 0,
        deletedCount,
        customerId,
      },
    };
  } catch (err) {
    return {
      executed: false,
      error: err instanceof Error ? err.message : "CRM delete failed.",
      output: { customerId },
    };
  }
}
