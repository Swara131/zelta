import { createHash, randomBytes, timingSafeEqual } from "crypto";
import {
  EXECUTION_TOKEN_BRAND,
  EXECUTION_TOKEN_ID_LENGTH,
  EXECUTION_TOKEN_MIN_LENGTH,
  EXECUTION_TOKEN_SECRET_BYTES,
} from "./constants";

export interface GeneratedExecutionTokenMaterial {
  plainToken: string;
  tokenPrefix: string;
  tokenHash: string;
}

function getPepper(): string {
  return (
    process.env.GATEWAY_EXECUTION_TOKEN_PEPPER?.trim() ??
    process.env.GATEWAY_API_KEY_PEPPER?.trim() ??
    ""
  );
}

/** SHA-256 hash of pepper + plaintext token (server-side only). */
export function hashExecutionToken(plainToken: string): string {
  return createHash("sha256")
    .update(getPepper() + plainToken, "utf8")
    .digest("hex");
}

/** Constant-time comparison of a plaintext token against a stored hash. */
export function verifyExecutionToken(plainToken: string, storedHash: string): boolean {
  const computed = hashExecutionToken(plainToken);
  const a = Buffer.from(computed, "hex");
  const b = Buffer.from(storedHash, "hex");

  if (a.length !== b.length) {
    return false;
  }

  return timingSafeEqual(a, b);
}

export function extractExecutionTokenPrefix(plainToken: string): string | null {
  const match = plainToken.match(/^(et_[a-f0-9]+)_/i);
  return match?.[1] ?? null;
}

/** Generates a cryptographically random execution token; plaintext is shown once. */
export function generateExecutionTokenMaterial(): GeneratedExecutionTokenMaterial {
  const idPart = randomBytes(EXECUTION_TOKEN_ID_LENGTH / 2).toString("hex");
  const secret = randomBytes(EXECUTION_TOKEN_SECRET_BYTES).toString("base64url");
  const tokenPrefix = `${EXECUTION_TOKEN_BRAND}_${idPart}`;
  const plainToken = `${tokenPrefix}_${secret}`;
  const tokenHash = hashExecutionToken(plainToken);

  return { plainToken, tokenPrefix, tokenHash };
}

export function isPlausibleExecutionToken(value: string): boolean {
  if (value.length < EXECUTION_TOKEN_MIN_LENGTH) {
    return false;
  }

  return (
    value.startsWith(`${EXECUTION_TOKEN_BRAND}_`) &&
    extractExecutionTokenPrefix(value) !== null
  );
}
