import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { mapApprovalChannelPreferences } from "@/lib/settings/approval-channels";
import { normalizeIndianPhoneInput } from "@/lib/whatsapp/phone";
import { WhatsAppPhoneError, WhatsAppVerificationError } from "@/lib/whatsapp/errors";
import { verifyWhatsAppCode } from "@/lib/whatsapp/verification";
import { getUserApprovalChannels } from "@/lib/whatsapp/repository";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { phone?: string; code?: string };
  const phoneInput = body.phone?.trim();
  const code = body.code?.trim();

  if (!phoneInput || !code) {
    return NextResponse.json(
      { error: "Enter your phone number and verification code." },
      { status: 400 }
    );
  }

  try {
    const phoneE164 = normalizeIndianPhoneInput(phoneInput);
    const verified = await verifyWhatsAppCode(supabase, {
      userId: user.id,
      phoneE164,
      code,
    });

    const row = await getUserApprovalChannels(supabase, user.id);

    return NextResponse.json({
      ok: true,
      verifiedAt: verified.verifiedAt,
      channels: mapApprovalChannelPreferences(row),
    });
  } catch (err) {
    if (err instanceof WhatsAppPhoneError || err instanceof WhatsAppVerificationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }

    const message = err instanceof Error ? err.message : "Verification failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
