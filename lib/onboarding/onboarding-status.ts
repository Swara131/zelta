import type { User } from "@supabase/supabase-js";

type ProfileOnboarding = {
  onboarding_completed_at?: string | null;
} | null;

export function getOnboardingCompletedAt(
  user: User,
  profile?: ProfileOnboarding
): string | null {
  if (profile?.onboarding_completed_at) {
    return profile.onboarding_completed_at;
  }

  const fromMetadata = user.user_metadata?.onboarding_completed_at;
  return typeof fromMetadata === "string" ? fromMetadata : null;
}

export function isOnboardingComplete(
  user: User,
  profile?: ProfileOnboarding
): boolean {
  return Boolean(getOnboardingCompletedAt(user, profile));
}

/** DB schema not ready for onboarding writes on public.users — use auth metadata. */
export function shouldUseMetadataOnboardingStorage(
  message: string | undefined
): boolean {
  if (!message) return false;
  return /onboarding_completed_at|onboarding_responses|schema cache|updated_at/i.test(
    message
  );
}
