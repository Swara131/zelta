import { createHash, randomBytes, timingSafeEqual } from "crypto";
import {
  EMAIL_APPROVAL_TOKEN_BRAND,
  EMAIL_APPROVAL_TOKEN_ID_LENGTH,
  EMAIL_APPROVAL_TOKEN_MIN_LENGTH,
  EMAIL_APPROVAL_TOKEN_SECRET_BYTES,
} from "./constants";

export interface GeneratedEmailApprovalToken {
  plainToken: string;
  tokenPrefix: string;
  tokenHash: string;
}

function getPepper(): string {
  return (
    process.env.EMAIL_APPROVAL_TOKEN_PEPPER?.trim() ??
    process.env.GATEWAY_EXECUTION_TOKEN_PEPPER?.trim() ??
    process.env.GATEWAY_API_KEY_PEPPER?.trim() ??
    ""
  );
}

export function hashEmailApprovalToken(plainToken: string): string {
  return createHash("sha256")
    .update(getPepper() + plainToken, "utf8")
    .digest("hex");
}

export function verifyEmailApprovalToken(
  plainToken: string,
  storedHash: string
): boolean {
  const computed = hashEmailApprovalToken(plainToken);
  const a = Buffer.from(computed, "hex");
  const b = Buffer.from(storedHash, "hex");

  if (a.length !== b.length) {
    return false;
  }

  return timingSafeEqual(a, b);
}

export function isPlausibleEmailApprovalToken(value: string): boolean {
  if (value.length < EMAIL_APPROVAL_TOKEN_MIN_LENGTH) {
    return false;
  }

  return value.startsWith(`${EMAIL_APPROVAL_TOKEN_BRAND}_`);
}

export function generateEmailApprovalToken(): GeneratedEmailApprovalToken {
  const idPart = randomBytes(EMAIL_APPROVAL_TOKEN_ID_LENGTH / 2).toString("hex");
  const secret = randomBytes(EMAIL_APPROVAL_TOKEN_SECRET_BYTES).toString("base64url");
  const tokenPrefix = `${EMAIL_APPROVAL_TOKEN_BRAND}_${idPart}`;
  const plainToken = `${tokenPrefix}_${secret}`;
  const tokenHash = hashEmailApprovalToken(plainToken);

  return { plainToken, tokenPrefix, tokenHash };
}
