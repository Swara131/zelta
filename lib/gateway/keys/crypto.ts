import { createHash, randomBytes, timingSafeEqual } from "crypto";
import {
  AGENT_KEY_BRAND,
  AGENT_KEY_ID_LENGTH,
  AGENT_KEY_MIN_LENGTH,
  AGENT_KEY_SECRET_BYTES,
} from "./constants";

export interface GeneratedAgentApiKeyMaterial {
  plainKey: string;
  keyPrefix: string;
  keyHash: string;
}

function getPepper(): string {
  return process.env.GATEWAY_API_KEY_PEPPER?.trim() ?? "";
}

/** SHA-256 hash of pepper + plaintext key (server-side only). */
export function hashAgentApiKey(plainKey: string): string {
  return createHash("sha256")
    .update(getPepper() + plainKey, "utf8")
    .digest("hex");
}

/** Constant-time comparison of a plaintext key against a stored hash. */
export function verifyAgentApiKey(plainKey: string, storedHash: string): boolean {
  const computed = hashAgentApiKey(plainKey);
  const a = Buffer.from(computed, "hex");
  const b = Buffer.from(storedHash, "hex");

  if (a.length !== b.length) {
    return false;
  }

  return timingSafeEqual(a, b);
}

/** Extracts the non-secret prefix used for identification (`al_<id>`). */
export function extractKeyPrefix(plainKey: string): string | null {
  const match = plainKey.match(/^(al_[a-f0-9]+)_/i);
  return match?.[1] ?? null;
}

/** Generates a new agent API key; plaintext is shown once and never stored. */
export function generateAgentApiKeyMaterial(): GeneratedAgentApiKeyMaterial {
  const idPart = randomBytes(AGENT_KEY_ID_LENGTH / 2).toString("hex");
  const secret = randomBytes(AGENT_KEY_SECRET_BYTES).toString("base64url");
  const keyPrefix = `${AGENT_KEY_BRAND}_${idPart}`;
  const plainKey = `${keyPrefix}_${secret}`;
  const keyHash = hashAgentApiKey(plainKey);

  return { plainKey, keyPrefix, keyHash };
}

export function isPlausibleAgentApiKey(value: string): boolean {
  if (value.length < AGENT_KEY_MIN_LENGTH) {
    return false;
  }

  return value.startsWith(`${AGENT_KEY_BRAND}_`) && extractKeyPrefix(value) !== null;
}
