import { getPayPalWebhookId } from "./env";
import { paypalApiRequest } from "./client";
import type {
  PayPalVerifyWebhookResponse,
  PayPalWebhookEvent,
} from "./types";

export type PayPalWebhookHeaders = {
  authAlgo: string;
  certUrl: string;
  transmissionId: string;
  transmissionSig: string;
  transmissionTime: string;
};

export function parsePayPalWebhookHeaders(
  headers: Headers
): PayPalWebhookHeaders | null {
  const authAlgo = headers.get("paypal-auth-algo");
  const certUrl = headers.get("paypal-cert-url");
  const transmissionId = headers.get("paypal-transmission-id");
  const transmissionSig = headers.get("paypal-transmission-sig");
  const transmissionTime = headers.get("paypal-transmission-time");

  if (
    !authAlgo ||
    !certUrl ||
    !transmissionId ||
    !transmissionSig ||
    !transmissionTime
  ) {
    return null;
  }

  return {
    authAlgo,
    certUrl,
    transmissionId,
    transmissionSig,
    transmissionTime,
  };
}

export async function verifyPayPalWebhookSignature(
  rawBody: string,
  webhookHeaders: PayPalWebhookHeaders
): Promise<PayPalWebhookEvent> {
  let webhookEvent: PayPalWebhookEvent;

  try {
    webhookEvent = JSON.parse(rawBody) as PayPalWebhookEvent;
  } catch {
    throw new Error("Invalid PayPal webhook JSON body.");
  }

  const result = await paypalApiRequest<PayPalVerifyWebhookResponse>(
    "/v1/notifications/verify-webhook-signature",
    {
      method: "POST",
      body: JSON.stringify({
        auth_algo: webhookHeaders.authAlgo,
        cert_url: webhookHeaders.certUrl,
        transmission_id: webhookHeaders.transmissionId,
        transmission_sig: webhookHeaders.transmissionSig,
        transmission_time: webhookHeaders.transmissionTime,
        webhook_id: getPayPalWebhookId(),
        webhook_event: webhookEvent,
      }),
    }
  );

  if (result.verification_status !== "SUCCESS") {
    throw new Error("PayPal webhook signature verification failed.");
  }

  return webhookEvent;
}
