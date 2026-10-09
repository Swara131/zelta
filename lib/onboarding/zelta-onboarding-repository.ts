import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { shouldUseMetadataOnboardingStorage } from "./onboarding-status";
import type {
  UserOnboardingState,
  ZeltaOnboardingResponses,
} from "./zelta-onboarding-types";

export type OnboardingSaveResult = UserOnboardingState & {
  /** When true, the client should refresh the auth session. */
  refreshSession: boolean;
};

function parseResponses(value: unknown): ZeltaOnboardingResponses {
  if (!value || typeof value !== "object") return {};
  return value as ZeltaOnboardingResponses;
}

function stateFromMetadata(
  metadata: Record<string, unknown> | undefined
): UserOnboardingState {
  const completedAt =
    typeof metadata?.onboarding_completed_at === "string"
      ? metadata.onboarding_completed_at
      : null;

  return {
    completed: Boolean(completedAt),
    completedAt,
    responses: parseResponses(metadata?.onboarding_responses),
  };
}

async function getUserOnboardingFromMetadata(
  userId: string
): Promise<UserOnboardingState> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.getUserById(userId);

  if (error || !data.user) {
    throw new Error(error?.message ?? "Failed to load onboarding state.");
  }

  return stateFromMetadata(data.user.user_metadata);
}

async function saveUserOnboardingToMetadata(params: {
  userId: string;
  responses: ZeltaOnboardingResponses;
  completed?: boolean;
}): Promise<UserOnboardingState> {
  const admin = createAdminClient();
  const { data: existing, error: loadError } =
    await admin.auth.admin.getUserById(params.userId);

  if (loadError || !existing.user) {
    throw new Error(loadError?.message ?? "Failed to load user profile.");
  }

  const metadata: Record<string, unknown> = {
    ...(existing.user.user_metadata ?? {}),
    onboarding_responses: params.responses,
  };

  if (params.completed) {
    metadata.onboarding_completed_at = new Date().toISOString();
  }

  const { data: updated, error: updateError } =
    await admin.auth.admin.updateUserById(params.userId, {
      user_metadata: metadata,
    });

  if (updateError || !updated.user) {
    throw new Error(updateError?.message ?? "Failed to save onboarding responses.");
  }

  return stateFromMetadata(updated.user.user_metadata);
}

export async function getUserOnboardingState(
  supabase: SupabaseClient,
  userId: string
): Promise<UserOnboardingState> {
  const { data, error } = await supabase
    .from("users")
    .select("onboarding_completed_at, onboarding_responses")
    .eq("id", userId)
    .maybeSingle();

  if (error && shouldUseMetadataOnboardingStorage(error.message)) {
    return getUserOnboardingFromMetadata(userId);
  }

  if (error) {
    throw new Error(error.message ?? "Failed to load onboarding state.");
  }

  const dbState: UserOnboardingState = {
    completed: Boolean(data?.onboarding_completed_at),
    completedAt: data?.onboarding_completed_at ?? null,
    responses: parseResponses(data?.onboarding_responses),
  };

  if (dbState.completed) {
    return dbState;
  }

  try {
    const metadataState = await getUserOnboardingFromMetadata(userId);
    if (metadataState.completed) {
      return metadataState;
    }
  } catch {
    /* metadata unavailable */
  }

  return dbState;
}

export async function saveUserOnboardingResponses(
  supabase: SupabaseClient,
  params: {
    userId: string;
    responses: ZeltaOnboardingResponses;
    completed?: boolean;
  }
): Promise<OnboardingSaveResult> {
  const patch: Record<string, unknown> = {
    onboarding_responses: params.responses,
  };

  if (params.completed) {
    patch.onboarding_completed_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("users")
    .update(patch)
    .eq("id", params.userId)
    .select("onboarding_completed_at, onboarding_responses")
    .single();

  if (error && shouldUseMetadataOnboardingStorage(error.message)) {
    const state = await saveUserOnboardingToMetadata(params);
    return { ...state, refreshSession: true };
  }

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to save onboarding responses.");
  }

  return {
    completed: Boolean(data.onboarding_completed_at),
    completedAt: data.onboarding_completed_at ?? null,
    responses: parseResponses(data.onboarding_responses),
    refreshSession: false,
  };
}
