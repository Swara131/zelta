/**
 * Ensures public.agent_crm_updates exists for the CRM Updater Agent.
 *
 * Run: npm run migrate:crm-updates
 *
 * Requires SUPABASE_DB_URL in .env.local (Supabase → Project Settings → Database → URI).
 * Or paste the migration SQL in Supabase Dashboard → SQL Editor.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createAdminClient } from "../lib/supabase/admin";

const MIGRATION_FILE = "20260926160000_agent_crm_updates.sql";

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
    // optional when vars are exported
  }
}

async function tableExists(): Promise<boolean> {
  const admin = createAdminClient();
  const { error } = await admin.from("agent_crm_updates").select("id").limit(1);
  return !error;
}

async function applyViaPostgres(dbUrl: string, sql: string): Promise<void> {
  const postgres = (await import("postgres")).default;
  const sqlClient = postgres(dbUrl, { max: 1 });
  try {
    await sqlClient.unsafe(sql);
  } finally {
    await sqlClient.end({ timeout: 5 });
  }
}

function printManualInstructions() {
  console.log("\nApply this migration in Supabase Dashboard → SQL Editor:\n");
  console.log(`  supabase/migrations/${MIGRATION_FILE}\n`);
  console.log("Steps:");
  console.log("  1. Open https://supabase.com/dashboard → your project → SQL Editor");
  console.log("  2. Paste the full contents of the migration file");
  console.log("  3. Click Run");
  console.log("  4. Re-run Full Test on the CRM Updater Agent\n");
  console.log("Automated apply: add your database URI to .env.local:");
  console.log("  SUPABASE_DB_URL=postgresql://postgres.[ref]:[password]@...pooler.supabase.com:5432/postgres");
  console.log("Then run: npm run migrate:crm-updates\n");

  const sqlPath = resolve(process.cwd(), "supabase", "migrations", MIGRATION_FILE);
  try {
    const sql = readFileSync(sqlPath, "utf8");
    console.log("--- Migration SQL (copy from here) ---\n");
    console.log(sql);
    console.log("\n--- End migration SQL ---");
  } catch {
    console.log(`Could not read ${sqlPath}`);
  }
}

async function main() {
  loadEnvLocal();

  if (await tableExists()) {
    console.log("✓ public.agent_crm_updates already exists. CRM Updater Agent should work.");
    return;
  }

  const sqlPath = resolve(process.cwd(), "supabase", "migrations", MIGRATION_FILE);
  const sql = readFileSync(sqlPath, "utf8");
  const dbUrl = process.env.SUPABASE_DB_URL?.trim();

  if (dbUrl) {
    console.log("Applying CRM updates migration via SUPABASE_DB_URL…");
    try {
      await applyViaPostgres(dbUrl, sql);
    } catch (err) {
      console.error("Failed to apply migration via postgres:", err);
      printManualInstructions();
      process.exit(1);
    }

    if (await tableExists()) {
      console.log("✓ Migration applied. public.agent_crm_updates is ready.");
      return;
    }

    console.error("Migration ran but table is still missing (schema cache may need a moment).");
    console.error("Wait 10 seconds and re-run: npm run migrate:crm-updates");
    process.exit(1);
  }

  console.error("Missing table: public.agent_crm_updates\n");
  printManualInstructions();
  process.exit(1);
}

void main();
