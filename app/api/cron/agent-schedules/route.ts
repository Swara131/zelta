import { runDueAgentSchedules } from "@/lib/agents/scheduling/run-due-schedules";
import { createAdminClient } from "@/lib/supabase/admin";
import { isCronAuthorizedSecure } from "@/lib/security/env";
import { secureError, secureJson } from "@/lib/security/api";

export async function POST(request: Request) {
  return handleAgentScheduleCron(request);
}

export async function GET(request: Request) {
  return handleAgentScheduleCron(request);
}

async function handleAgentScheduleCron(request: Request) {
  if (!isCronAuthorizedSecure(request)) {
    return secureError("Unauthorized", 401);
  }

  try {
    const admin = createAdminClient();
    const result = await runDueAgentSchedules(admin, 10);
    return secureJson(result);
  } catch (err) {
    console.error("Agent schedule cron failed:", err);
    return secureError("Agent schedule cron failed.", 500);
  }
}
