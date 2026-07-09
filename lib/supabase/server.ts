import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "./database.types";
import { getSupabaseAnonKey, getSupabaseUrl } from "./env";

export type SupabaseServerClient = SupabaseClient<Database>;

/**
 * Reusable Supabase client for Server Components, Route Handlers, and Server Actions.
 * Creates a new client per request with cookie-backed session storage.
 *
 * @example
 * import { createClient } from "@/lib/supabase/server";
 * const supabase = await createClient();
 */
export async function createClient(): Promise<SupabaseServerClient> {
  const cookieStore = await cookies();

  return createServerClient<Database>(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // setAll can fail in Server Components; Route Handlers can set cookies.
        }
      },
    },
  });
}
