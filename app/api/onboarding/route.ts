import { ensureUserProfile } from "@/lib/users/ensure-user-profile";
import {
  getUserOnboardingState,
  saveUserOnboardingResponses,
} from "@/lib/onboarding/zelta-onboarding-repository";
import type { ZeltaOnboardingResponses } from "@/lib/onboarding/zelta-onboarding-types";
import { parseJsonBody, secureError, secureJson } from "@/lib/security/api";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const onboardingSchema = z.object({
  responses: z.record(z.string(), z.unknown()),
  complete: z.boolean().optional(),
});

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return secureError("Unauthorized", 401);
  }

  try {
    await ensureUserProfile(supabase, user);
    const state = await getUserOnboardingState(supabase, user.id);
    return secureJson(state);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load onboarding.";
    return secureError(message, 500);
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return secureError("Unauthorized", 401);
  }

  try {
    const body = await parseJsonBody(request, onboardingSchema);
    await ensureUserProfile(supabase, user);
    const state = await saveUserOnboardingResponses(supabase, {
      userId: user.id,
      responses: body.responses as ZeltaOnboardingResponses,
      completed: body.complete ?? false,
    });

    if (state.refreshSession) {
      await supabase.auth.refreshSession();
    }

    const { refreshSession, ...payload } = state;
    if (refreshSession) {
      // Session refresh already ran immediately after save.
    }
    return secureJson(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save onboarding.";
    return secureError(message, 500);
  }
}
