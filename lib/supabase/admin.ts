import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";

const PLACEHOLDER_SERVICE_ROLE_KEYS = new Set([
  "your-service-role-key",
  "your_service_role_key",
]);

function getServiceRoleKey(): string {
  const value =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ??
    process.env.SUPABASE_SECRET_KEY?.trim();

  if (!value) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY). Required for the agent gateway, approvals, and Stripe webhooks. Copy the secret key from Supabase Dashboard → Project Settings → API."
    );
  }

  if (PLACEHOLDER_SERVICE_ROLE_KEYS.has(value)) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is still the placeholder value. Paste your Supabase secret key (service_role JWT or sb_secret_...) into .env.local and restart the dev server."
    );
  }

  return value;
}

let adminClient: SupabaseClient<Database> | null = null;

/** Service-role client for webhook handlers (bypasses RLS). */
export function createAdminClient(): SupabaseClient<Database> {
  if (!adminClient) {
    adminClient = createClient<Database>(
      getSupabaseUrl(),
      getServiceRoleKey(),
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  }
  return adminClient;
}

/** Anon client without cookies — used when service role is unavailable. */
export function createServiceClient(): SupabaseClient<Database> {
  return createClient<Database>(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
