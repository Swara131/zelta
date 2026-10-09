import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizeIndianPhoneInput } from "@/lib/whatsapp/phone";
import { WhatsAppPhoneError, WhatsAppVerificationError } from "@/lib/whatsapp/errors";
import { sendWhatsAppVerificationCode } from "@/lib/whatsapp/verification";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { phone?: string };
  const phoneInput = body.phone?.trim();

  if (!phoneInput) {
    return NextResponse.json({ error: "Enter your WhatsApp number." }, { status: 400 });
  }

  try {
    const phoneE164 = normalizeIndianPhoneInput(phoneInput);
    const result = await sendWhatsAppVerificationCode(supabase, {
      userId: user.id,
      phoneE164,
    });

    return NextResponse.json({
      ok: true,
      expiresAt: result.expiresAt,
      devCode: result.devCode,
    });
  } catch (err) {
    if (err instanceof WhatsAppPhoneError || err instanceof WhatsAppVerificationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }

    const message = err instanceof Error ? err.message : "Failed to send verification code.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
