import { NextResponse } from "next/server";
import { EmailNotificationError } from "@/lib/email/errors";
import { retryNotification } from "@/lib/email/service";
import { createClient } from "@/lib/supabase/server";

export async function POST(
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
    const result = await retryNotification(supabase, id, request);
    const status = result.success ? 200 : 400;
    return NextResponse.json(result, { status });
  } catch (err) {
    const message =
      err instanceof EmailNotificationError ? err.message : "Retry failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
