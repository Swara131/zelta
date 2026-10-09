/**
 * Checks whether decision_agents tables exist and prints apply instructions.
 * Run: npx tsx scripts/apply-decision-agents-migration.ts
 *
 * To apply the migration, paste the SQL file in Supabase Dashboard → SQL Editor:
 * supabase/migrations/20260925180000_decision_agents.sql
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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
    // .env.local optional when vars are already exported
  }
}

loadEnvLocal();

const MIGRATION_FILE = "20260925180000_decision_agents.sql";

async function main() {
  const admin = createAdminClient();

  const { error } = await admin.from("decision_agents").select("id").limit(1);

  if (!error) {
    console.log("✓ public.decision_agents already exists. Decision Agents should work.");
    return;
  }

  const message = error.message ?? "";
  console.error("Decision agents tables are missing.\n");
  console.error(`Supabase error: ${message}\n`);

  if (/schema cache|does not exist|Could not find the table/i.test(message)) {
    console.log("Apply this migration in Supabase Dashboard → SQL Editor:\n");
    console.log(`  supabase/migrations/${MIGRATION_FILE}\n`);
    console.log("Steps:");
    console.log("  1. Open https://supabase.com/dashboard → your project → SQL Editor");
    console.log("  2. Paste the full contents of the migration file");
    console.log("  3. Click Run");
    console.log("  4. Refresh the Decision Agents page\n");

    const sqlPath = resolve(
      process.cwd(),
      "supabase",
      "migrations",
      MIGRATION_FILE
    );
    try {
      const sql = readFileSync(sqlPath, "utf8");
      console.log("--- Migration SQL (copy from here) ---\n");
      console.log(sql);
      console.log("\n--- End migration SQL ---");
    } catch {
      console.log(`Could not read ${sqlPath}`);
    }
  }

  process.exit(1);
}

void main();
