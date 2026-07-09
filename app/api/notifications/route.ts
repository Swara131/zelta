import { NextResponse } from "next/server";
import { EmailNotificationError } from "@/lib/email/errors";
import { mapNotificationRow } from "@/lib/email/notifications-mapper";
import {
  listUserNotifications,
  markAllNotificationsRead,
} from "@/lib/email/repository";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rows = await listUserNotifications(supabase, user.id);
    return NextResponse.json({
      notifications: rows.map(mapNotificationRow),
    });
  } catch (err) {
    const message =
      err instanceof EmailNotificationError
        ? err.message
        : "Failed to load notifications.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await markAllNotificationsRead(supabase, user.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message =
      err instanceof EmailNotificationError
        ? err.message
        : "Failed to mark notifications as read.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
