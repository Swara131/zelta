import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  mapApprovalChannelPreferences,
} from "@/lib/settings/approval-channels";
import {
  getUserApprovalChannels,
  updateUserApprovalChannels,
} from "@/lib/whatsapp/repository";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const row = await getUserApprovalChannels(supabase, user.id);
  return NextResponse.json({ channels: mapApprovalChannelPreferences(row) });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    emailEnabled?: boolean;
    whatsappEnabled?: boolean;
    dashboardEnabled?: boolean;
  };

  const current = await getUserApprovalChannels(supabase, user.id);
  const currentMapped = mapApprovalChannelPreferences(current);

  const emailEnabled = body.emailEnabled ?? currentMapped.emailEnabled;
  const dashboardEnabled = body.dashboardEnabled ?? currentMapped.dashboardEnabled;
  const whatsappEnabled = body.whatsappEnabled ?? currentMapped.whatsappEnabled;

  if (whatsappEnabled && !currentMapped.whatsappVerified) {
    return NextResponse.json(
      { error: "Verify your WhatsApp number before enabling WhatsApp alerts." },
      { status: 400 }
    );
  }

  if (!emailEnabled && !dashboardEnabled && !whatsappEnabled) {
    return NextResponse.json(
      { error: "Keep at least one approval channel enabled." },
      { status: 400 }
    );
  }

  const updated = await updateUserApprovalChannels(supabase, user.id, {
    approval_email_enabled: emailEnabled,
    approval_dashboard_enabled: dashboardEnabled,
    approval_whatsapp_enabled: whatsappEnabled,
  });

  return NextResponse.json({ channels: mapApprovalChannelPreferences(updated) });
}
