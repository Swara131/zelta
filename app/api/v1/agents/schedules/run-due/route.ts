import { runDueAgentSchedules } from "@/lib/agents/scheduling/run-due-schedules";
import { tickAgentScheduler } from "@/lib/agents/scheduling/agent-scheduler";
import { createAdminClient } from "@/lib/supabase/admin";
import { secureError, secureJson } from "@/lib/security/api";
import { isCronAuthorizedSecure } from "@/lib/security/env";
import { createClient } from "@/lib/supabase/server";

/**
 * Manual / dev trigger for the agent schedule runner.
 * Authenticated users may call in development; production also accepts cron bearer token.
 */
export async function POST(request: Request) {
  const cronOk = isCronAuthorizedSecure(request);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isDev = process.env.NODE_ENV !== "production";

  if (!cronOk && !user) {
    return secureError("Unauthorized", 401);
  }

  if (!cronOk && !isDev && !user) {
    return secureError("Forbidden", 403);
  }

  try {
    console.log("[scheduler] manual run-due trigger");
    const admin = createAdminClient();
    const result = await runDueAgentSchedules(admin, 10);
    return secureJson({ success: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Schedule run failed.";
    return secureJson({ success: false, error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  if (!isCronAuthorizedSecure(request)) {
    return secureError("Unauthorized", 401);
  }

  await tickAgentScheduler("cron-get");
  return secureJson({ success: true });
}
