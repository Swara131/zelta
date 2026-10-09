import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MARKETPLACE_TEMPLATES } from "../lib/templates/marketplace-catalog";
import { toTemplateRow } from "../lib/templates/seed-rows";
import { createAdminClient } from "../lib/supabase/admin";

function loadEnvLocal() {
  try {
    const content = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      if (process.env[key]) continue;
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  } catch {
    // optional
  }
}

export async function seedMarketplaceTemplates(): Promise<{ upserted: number }> {
  const admin = createAdminClient();
  const rows = MARKETPLACE_TEMPLATES.map(toTemplateRow);
  const { error } = await admin.from("templates").upsert(rows, { onConflict: "id" });
  if (error) {
    throw new Error(error.message);
  }
  return { upserted: rows.length };
}

async function main() {
  loadEnvLocal();
  const result = await seedMarketplaceTemplates();
  console.log(`✓ Upserted ${result.upserted} marketplace templates by slug/id.`);
}

if (
  process.argv[1]?.includes("seed-agent-templates")
) {
  void main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    console.error(
      "If columns are missing, run supabase/migrations/20260930120000_agent_templates_marketplace.sql"
    );
    process.exit(1);
  });
}
