/**
 * Supabase environment variables (browser-safe).
 * Use static process.env.NEXT_PUBLIC_* references so Next.js inlines them in client bundles.
 */

function missingEnv(name: string): never {
  throw new Error(
    `Missing environment variable: ${name}. ` +
      `Add it to .env.local in the project root (see .env.example).`
  );
}

export function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url) {
    missingEnv("NEXT_PUBLIC_SUPABASE_URL");
  }
  if (!url.startsWith("https://") || !url.includes(".supabase.co")) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL must be a valid Supabase HTTPS project URL."
    );
  }
  return url;
}

export function getSupabaseAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!key) {
    missingEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return key;
}

/** Typed snapshot of public Supabase env vars (browser-safe). */
export function getSupabasePublicEnv() {
  return {
    url: getSupabaseUrl(),
    anonKey: getSupabaseAnonKey(),
  } as const;
}
