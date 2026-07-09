import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { getSupabaseAnonKey, getSupabaseUrl } from "./env";

export type SupabaseBrowserClient = SupabaseClient<Database>;

let browserClient: SupabaseBrowserClient | undefined;

/**
 * Reusable Supabase client for Client Components (`"use client"`).
 * Uses a singleton so multiple hooks/components share one instance.
 *
 * @example
 * import { createClient } from "@/lib/supabase/client";
 * const supabase = createClient();
 */
export function createClient(): SupabaseBrowserClient {
  if (browserClient) {
    return browserClient;
  }

  browserClient = createBrowserClient<Database>(
    getSupabaseUrl(),
    getSupabaseAnonKey()
  );

  return browserClient;
}
