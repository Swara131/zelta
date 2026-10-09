import { createAdminClient } from "@/lib/supabase/admin";
import type { ToolExecutionOutcome, ToolHandlerContext } from "../../runtime/types";

const ALLOWED_TABLES = new Set(["agents", "uploaded_logs", "action_proposals"]);

export async function handleQuerySupabase(
  input: Record<string, unknown>,
  context: ToolHandlerContext
): Promise<ToolExecutionOutcome> {
  const table =
    (typeof input.table === "string" && input.table.trim()) ||
    (typeof input.resource === "string" && input.resource.trim()) ||
    "agents";

  if (!ALLOWED_TABLES.has(table)) {
    return {
      executed: false,
      error: `Table "${table}" is not allowed. Allowed: ${[...ALLOWED_TABLES].join(", ")}.`,
      output: { table },
    };
  }

  const limit =
    typeof input.limit === "number" && input.limit > 0 && input.limit <= 25
      ? Math.floor(input.limit)
      : 10;

  try {
    const admin = createAdminClient();
    let query = admin.from(table).select("*").eq("user_id", context.userId).limit(limit);

    if (table === "agents" && typeof input.slug === "string" && input.slug.trim()) {
      query = query.eq("slug", input.slug.trim());
    }

    if (table === "uploaded_logs" && typeof input.status === "string" && input.status.trim()) {
      query = query.eq("status", input.status.trim());
    }

    const { data, error } = await query;

    if (error) {
      return {
        executed: false,
        error: error.message,
        output: { table },
      };
    }

    return {
      executed: true,
      output: {
        table,
        rowCount: data?.length ?? 0,
        rows: data ?? [],
      },
    };
  } catch (err) {
    return {
      executed: false,
      error: err instanceof Error ? err.message : "Database query failed.",
      output: { table },
    };
  }
}
