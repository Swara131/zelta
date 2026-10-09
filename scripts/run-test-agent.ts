/**
 * Run a published agent through the Wave internal runtime.
 *
 * Usage:
 *   npx tsx scripts/run-test-agent.ts <agent-slug> "Task description"
 *
 * Requires SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and authenticated user context
 * via RUNTIME_USER_ID / RUNTIME_USER_EMAIL env vars.
 */
import { createClient } from "@supabase/supabase-js";
import { runAgentEngine } from "../lib/agents/runtime/run-agent";
import { getBuilderAgentForUserBySlug } from "../lib/agents/save-builder-agent-draft";

async function main() {
  const slug = process.argv[2]?.trim();
  const task = process.argv.slice(3).join(" ").trim();

  if (!slug || !task) {
    console.error('Usage: npx tsx scripts/run-test-agent.ts <agent-slug> "Task description"');
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  const userId = process.env.RUNTIME_USER_ID?.trim();
  const userEmail = process.env.RUNTIME_USER_EMAIL?.trim() ?? "runtime@test.local";

  if (!userId) {
    console.error("Set RUNTIME_USER_ID to the agent owner's user id.");
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const agent = await getBuilderAgentForUserBySlug(supabase, {
    userId,
    userEmail,
    slug,
  });

  if (!agent) {
    console.error(`Agent not found for slug: ${slug}`);
    process.exit(1);
  }

  console.log(`Running agent: ${agent.name} (${agent.slug})`);
  console.log(`Task: ${task}\n`);

  const result = await runAgentEngine(supabase, {
    agentDbId: agent.id,
    userId,
    userEmail,
    task,
    mode: "test",
    triggerSource: "cli",
  });

  console.log(JSON.stringify(result, null, 2));
  process.exit(result.status === "completed" ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
