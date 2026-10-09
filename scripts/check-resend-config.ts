import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  getResendConfigStatus,
  parseFromEmailAddress,
} from "../lib/email/resend-config";

function loadEnvFile(filename: string): void {
  const path = resolve(process.cwd(), filename);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (value) process.env[key] = value;
  }
}

loadEnvFile(".env.local");
const status = getResendConfigStatus();
console.log(
  JSON.stringify(
    {
      configured: status.configured,
      from: process.env.RESEND_FROM_EMAIL
        ? parseFromEmailAddress(process.env.RESEND_FROM_EMAIL)
        : null,
      sandboxMode: status.sandboxMode,
      sandboxRecipient: status.sandboxRecipient,
      error: status.error,
    },
    null,
    2
  )
);
