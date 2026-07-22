import {
  getPayPalApiBaseUrl,
  getPayPalClientId,
  getPayPalClientSecret,
} from "./env";
import { BillingError } from "@/lib/billing/errors";
import type { PayPalSubscriptionResource } from "./types";

type CachedToken = {
  accessToken: string;
  expiresAt: number;
};

let cachedToken: CachedToken | null = null;

async function fetchAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.accessToken;
  }

  const credentials = Buffer.from(
    `${getPayPalClientId()}:${getPayPalClientSecret()}`
  ).toString("base64");

  const response = await fetch(`${getPayPalApiBaseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new BillingError(`PayPal authentication failed (${response.status}).`);
  }

  const payload = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };

  cachedToken = {
    accessToken: payload.access_token,
    expiresAt: now + payload.expires_in * 1000,
  };

  return payload.access_token;
}

function parsePayPalError(body: string, status: number): string {
  try {
    const json = JSON.parse(body) as {
      message?: string;
      details?: Array<{ issue?: string; description?: string }>;
    };
    const detail =
      json.details?.[0]?.description ??
      json.details?.[0]?.issue ??
      json.message;
    if (detail) return detail;
  } catch {
    /* fall through */
  }
  return `PayPal request failed (${status}). Check plan IDs and PAYPAL_ENVIRONMENT match your credentials.`;
}

export async function paypalApiRequest<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const accessToken = await fetchAccessToken();
  const response = await fetch(`${getPayPalApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new BillingError(parsePayPalError(body, response.status));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function getPayPalSubscription(
  subscriptionId: string
): Promise<PayPalSubscriptionResource> {
  return paypalApiRequest<PayPalSubscriptionResource>(
    `/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`
  );
}

/** Clears cached OAuth token (for tests). */
export function resetPayPalTokenCache(): void {
  cachedToken = null;
}
