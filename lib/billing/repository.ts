import type { SupabaseClient } from "@supabase/supabase-js";
import type { BillingInterval, PlanId } from "@/lib/billing-types";
import { BillingError } from "./errors";

export type SubscriptionRow = {
  id: string;
  organization_id: string;
  plan: PlanId;
  status:
    | "active"
    | "trialing"
    | "past_due"
    | "canceled"
    | "incomplete"
    | "paused";
  billing_interval: BillingInterval;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  trial_end: string | null;
  created_at: string;
  updated_at: string;
};

const ACTIVE_STATUSES = ["active", "trialing", "past_due"] as const;

export function isSubscriptionEntitled(row: SubscriptionRow | null): boolean {
  if (!row) return false;
  return ACTIVE_STATUSES.includes(row.status as (typeof ACTIVE_STATUSES)[number]);
}

export function effectivePlan(row: SubscriptionRow | null): PlanId {
  if (!row || !isSubscriptionEntitled(row)) {
    return "free";
  }
  return row.plan;
}

export async function getOrgSubscription(
  supabase: SupabaseClient,
  organizationId: string
): Promise<SubscriptionRow | null> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("organization_id", organizationId)
    .in("status", [...ACTIVE_STATUSES, "canceled"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new BillingError(error.message);
  }

  return (data as SubscriptionRow | null) ?? null;
}

export async function getSubscriptionByStripeCustomerId(
  supabase: SupabaseClient,
  customerId: string
): Promise<SubscriptionRow | null> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("stripe_customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new BillingError(error.message);
  }

  return (data as SubscriptionRow | null) ?? null;
}

export async function getSubscriptionByStripeSubscriptionId(
  supabase: SupabaseClient,
  subscriptionId: string
): Promise<SubscriptionRow | null> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle();

  if (error) {
    throw new BillingError(error.message);
  }

  return (data as SubscriptionRow | null) ?? null;
}

export async function upsertOrgSubscription(
  supabase: SupabaseClient,
  organizationId: string,
  patch: Partial<
    Pick<
      SubscriptionRow,
      | "plan"
      | "status"
      | "billing_interval"
      | "stripe_customer_id"
      | "stripe_subscription_id"
      | "stripe_price_id"
      | "current_period_start"
      | "current_period_end"
      | "cancel_at_period_end"
      | "canceled_at"
      | "trial_end"
    >
  >
): Promise<SubscriptionRow> {
  const existing = await getOrgSubscription(supabase, organizationId);

  if (existing) {
    const { data, error } = await supabase
      .from("subscriptions")
      .update(patch)
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error || !data) {
      throw new BillingError(error?.message ?? "Failed to update subscription.");
    }

    return data as SubscriptionRow;
  }

  const { data, error } = await supabase
    .from("subscriptions")
    .insert({
      organization_id: organizationId,
      plan: patch.plan ?? "free",
      status: patch.status ?? "active",
      billing_interval: patch.billing_interval ?? "monthly",
      ...patch,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new BillingError(error?.message ?? "Failed to create subscription.");
  }

  return data as SubscriptionRow;
}

export async function setStripeCustomerId(
  supabase: SupabaseClient,
  organizationId: string,
  customerId: string
): Promise<void> {
  await upsertOrgSubscription(supabase, organizationId, {
    stripe_customer_id: customerId,
  });
}
