"use server";

import { createClient } from "@/lib/supabase/server";
import { getAuthCallbackUrlFromRequest } from "@/lib/auth/config";
import { AuthError, formatAuthErrorMessage, toAuthError } from "@/lib/auth/errors";
import { ensureOrganization } from "@/lib/organizations/ensure-organization";
import { ensureUserProfile } from "@/lib/users/ensure-user-profile";

/**
 * Email/password sign-in (server-side — works in Cursor preview and strict browsers).
 */
export async function signInWithEmail(email: string, password: string) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw toAuthError(error);
}

/**
 * Email/password sign-up. Returns whether a session was created immediately.
 */
export async function signUpWithEmail(
  email: string,
  password: string,
  redirectPath: string
) {
  const supabase = await createClient();
  const emailRedirectTo = await getAuthCallbackUrlFromRequest(redirectPath);

  let data;
  let error;
  try {
    ({ data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo },
    }));
  } catch (err) {
    const message =
      err instanceof Error && err.message.includes("fetch")
        ? "Could not reach Supabase. Check your internet connection and Supabase project URL in .env.local."
        : err instanceof Error
          ? err.message
          : "Sign up failed.";
    throw new AuthError(message);
  }

  if (error) {
    const authError = error as { message?: string; msg?: string; code?: string };
    const detail =
      authError.message?.trim() ||
      authError.msg?.trim() ||
      authError.code ||
      "unknown error";
    throw new AuthError(formatAuthErrorMessage(detail));
  }

  if (data.user?.identities?.length === 0) {
    throw new AuthError(
      "An account with this email already exists. Try signing in instead."
    );
  }

  if (data.session && data.user) {
    try {
      await ensureUserProfile(supabase, data.user);
      await ensureOrganization(
        supabase,
        data.user.id,
        data.user.email ?? "user@local"
      );
    } catch {
      // Profile is also created on first dashboard API call.
    }
  }

  return { session: data.session, user: data.user };
}
