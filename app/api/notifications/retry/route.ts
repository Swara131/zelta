import { EmailNotificationError } from "@/lib/email/errors";
import { retryFailedNotifications } from "@/lib/email/service";
import { isCronAuthorizedSecure } from "@/lib/security/env";
import { parseOptionalJsonBody, secureError, secureJson } from "@/lib/security/api";
import { ValidationError } from "@/lib/security/errors";
import { notificationRetryBatchSchema } from "@/lib/security/validation";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  return handleRetryBatch(request);
}

export async function GET(request: Request) {
  return handleRetryBatch(request);
}

async function handleRetryBatch(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const cronAuthorized = isCronAuthorizedSecure(request);

  if (!user && !cronAuthorized) {
    return secureError("Unauthorized", 401);
  }

  let limit = 25;

  try {
    const body = await parseOptionalJsonBody(request, notificationRetryBatchSchema, {
      limit: 25,
    });
    limit = body.limit;
  } catch (err) {
    if (err instanceof ValidationError) {
      return secureError(err.message, 400, { details: err.details });
    }
    /* default limit when body empty */
  }

  try {
    const result = await retryFailedNotifications(supabase, limit);
    return secureJson(result);
  } catch (err) {
    const message =
      err instanceof EmailNotificationError ? err.message : "Retry batch failed.";
    return secureError(message, 500);
  }
}
