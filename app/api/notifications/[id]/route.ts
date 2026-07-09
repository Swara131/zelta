import { NextResponse } from "next/server";
import { EmailNotificationError } from "@/lib/email/errors";
import { updateNotificationReadStatus } from "@/lib/email/repository";
import { parseJsonBody, secureError } from "@/lib/security/api";
import { ValidationError } from "@/lib/security/errors";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const notificationPatchSchema = z.object({
  status: z.enum(["read", "archived"]),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const body = await parseJsonBody(request, notificationPatchSchema);
    await updateNotificationReadStatus(supabase, id, user.id, body.status);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof ValidationError) {
      return secureError(err.message, 400, { details: err.details });
    }
    const message =
      err instanceof EmailNotificationError
        ? err.message
        : "Failed to update notification.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
