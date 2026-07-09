import { createClient } from "@/lib/supabase/client";
import { getAuthCallbackUrl } from "@/lib/auth/config";
import { AuthError, toAuthError } from "@/lib/auth/errors";

export { AuthError } from "@/lib/auth/errors";

export type OAuthProvider = "google";

/**
 * Starts Supabase OAuth (Google). Browser redirects away; session is
 * completed in `/auth/callback`.
 */
export async function signInWithOAuth(
  provider: OAuthProvider,
  redirectPath: string
): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: getAuthCallbackUrl(redirectPath),
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });

  if (error) {
    throw toAuthError(error);
  }
}

/**
 * Email/password sign-in and sign-up live in lib/auth/server-actions.ts
 * so auth requests run on the server (avoids browser "Failed to fetch" in embedded previews).
 */

/**
 * Sends password reset email.
 */
export async function sendPasswordResetEmail(email: string) {
  const supabase = createClient();
  const redirectTo = getAuthCallbackUrl("/auth/reset-password");
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });
  if (error) throw toAuthError(error);
}

/**
 * Signs out the current user (clears session cookies).
 */
export async function signOut() {
  const supabase = createClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw toAuthError(error);
}
