import {
  getPayPalApiBaseUrl,
  getPayPalClientId,
  getPayPalClientSecret,
} from "./env";
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
    throw new Error(`PayPal OAuth failed (${response.status}): ${body}`);
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
    throw new Error(`PayPal API ${path} failed (${response.status}): ${body}`);
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
