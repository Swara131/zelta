/**
 * Supabase client entry point.
 *
 * | Import from              | Use in                          |
 * |--------------------------|---------------------------------|
 * | `@/lib/supabase/client`  | Client Components ("use client") |
 * | `@/lib/supabase/server`  | Server Components, API routes    |
 */

export { createClient as createBrowserClient } from "./client";
export type { SupabaseBrowserClient } from "./client";

export { createClient as createServerClient } from "./server";
export type { SupabaseServerClient } from "./server";

export { getSupabaseAnonKey, getSupabasePublicEnv, getSupabaseUrl } from "./env";
export type { Database } from "./database.types";
