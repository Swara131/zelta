import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlanId } from "@/lib/billing-types";
import { ensureOrganization } from "@/lib/organizations/ensure-organization";
import {
  canAccessFeature,
  canAccessMinimumPlan,
  requiredPlanForFeature,
} from "./access";
import { PlanRequiredError, UsageLimitError } from "./errors";
import type { PremiumFeature } from "./plans";
import {
  effectivePlan,
  getOrgSubscription,
  type SubscriptionRow,
} from "./repository";

export interface BillingContext {
  organizationId: string;
  plan: PlanId;
  subscription: SubscriptionRow | null;
}

export async function getBillingContext(
  supabase: SupabaseClient,
  userId: string,
  userEmail: string
): Promise<BillingContext> {
  const organizationId = await ensureOrganization(supabase, userId, userEmail);
  const subscription = await getOrgSubscription(supabase, organizationId);
  const plan = effectivePlan(subscription);

  return { organizationId, plan, subscription };
}

export async function requireMinimumPlan(
  context: BillingContext,
  minimumPlan: PlanId
): Promise<void> {
  if (canAccessMinimumPlan(context.plan, minimumPlan)) {
    return;
  }

  // Preserve existing local-dev bypass when demo mode is off.
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  throw new PlanRequiredError(minimumPlan, context.plan);
}

export async function requireFeatureAccess(
  context: BillingContext,
  feature: PremiumFeature
): Promise<void> {
  if (canAccessFeature(context.plan, feature)) {
    return;
  }

  // Preserve existing local-dev bypass when demo mode is off.
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  throw new PlanRequiredError(requiredPlanForFeature(feature), context.plan);
}

export function billingErrorResponse(err: unknown): {
  status: number;
  body: { error: string; code?: string; requiredPlan?: string; currentPlan?: string };
} {
  if (err instanceof PlanRequiredError) {
    return {
      status: 403,
      body: {
        error: err.message,
        code: "plan_required",
        requiredPlan: err.requiredPlan,
        currentPlan: err.currentPlan,
      },
    };
  }

  if (err instanceof UsageLimitError) {
    return {
      status: 429,
      body: {
        error: err.message,
        code: "usage_limit",
      },
    };
  }

  return {
    status: 500,
    body: { error: err instanceof Error ? err.message : "Billing error." },
  };
}
