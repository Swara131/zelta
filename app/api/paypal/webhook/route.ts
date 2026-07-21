import { NextResponse } from "next/server";
import { BillingError } from "@/lib/billing/errors";
import { handlePayPalWebhookEvent } from "@/lib/paypal/sync";
import {
  parsePayPalWebhookHeaders,
  verifyPayPalWebhookSignature,
} from "@/lib/paypal/verify-webhook";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const webhookHeaders = parsePayPalWebhookHeaders(request.headers);

  if (!webhookHeaders) {
    return NextResponse.json(
      { error: "Missing PayPal webhook signature headers." },
      { status: 400 }
    );
  }

  let event;

  try {
    event = await verifyPayPalWebhookSignature(rawBody, webhookHeaders);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Invalid PayPal webhook signature.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const supabase = createAdminClient();

  try {
    await handlePayPalWebhookEvent(supabase, event);
  } catch (err) {
    const message =
      err instanceof BillingError ? err.message : "Webhook handler failed.";
    console.error("[paypal webhook]", event.event_type, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
