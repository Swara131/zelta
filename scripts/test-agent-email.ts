/**
 * Send a test agent-result email via Resend (uses .env.local).
 * Usage: npx tsx scripts/test-agent-email.ts you@example.com
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { sendHtmlEmail } from "../lib/email/resend-client";
import { renderEmailTemplate } from "../lib/email/templates/render";
import { getResendConfigStatus } from "../lib/email/resend-config";

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

async function main() {
  const to = process.argv[2]?.trim();
  if (!to) {
    console.error("Usage: npx tsx scripts/test-agent-email.ts <destination-email>");
    process.exit(1);
  }

  const status = getResendConfigStatus();
  if (!status.configured) {
    console.error(status.error);
    process.exit(1);
  }

  const rendered = renderEmailTemplate("agent_result", {
    agentName: "AI News",
    agentSlug: "custom-agent-2",
    summary: "Test summary from Wave agent email pipeline.",
    sources: ["https://example.com/test-source"],
    recipientName: "there",
    runMode: "scheduled",
    runAt: new Date().toISOString(),
    timezone: "Asia/Kolkata",
  });

  const result = await sendHtmlEmail({
    to,
    subject: rendered.subject,
    html: rendered.html,
  });

  console.log("[delivery] test email sent", { to, messageId: result.messageId });
}

main().catch((err) => {
  console.error("[delivery] test email failed", err instanceof Error ? err.message : err);
  process.exit(1);
});
