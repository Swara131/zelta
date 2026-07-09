import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import type { BillingInterval, PlanId } from "@/lib/billing-types";
import { resolvePlanFromStripePrice } from "./env";
import { BillingError } from "./errors";
import { PLAN_LABELS } from "./plans";
import {
  getSubscriptionByStripeCustomerId,
  getSubscriptionByStripeSubscriptionId,
  upsertOrgSubscription,
  type SubscriptionRow,
} from "./repository";

function mapStripeStatus(
  status: Stripe.Subscription.Status
): SubscriptionRow["status"] {
  switch (status) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
      return "past_due";
    case "canceled":
      return "canceled";
    case "paused":
      return "paused";
    case "incomplete":
    case "incomplete_expired":
    case "unpaid":
      return "incomplete";
    default:
      return "active";
  }
}

function planFromSubscription(
  subscription: Stripe.Subscription
): { plan: PlanId; interval: BillingInterval } {
  const priceId = subscription.items.data[0]?.price?.id;
  const metadataPlan = subscription.metadata.planId as PlanId | undefined;

  if (priceId) {
    const resolved = resolvePlanFromStripePrice(priceId);
    if (resolved) {
      return { plan: resolved.planId, interval: resolved.interval };
    }
  }

  if (metadataPlan && metadataPlan in PLAN_LABELS) {
    const interval =
      (subscription.metadata.interval as BillingInterval | undefined) ?? "monthly";
    return { plan: metadataPlan, interval };
  }

  return { plan: "professional", interval: "monthly" };
}

export async function syncStripeSubscription(
  supabase: SupabaseClient,
  stripeSubscription: Stripe.Subscription,
  organizationIdHint?: string
): Promise<SubscriptionRow> {
  const customerId =
    typeof stripeSubscription.customer === "string"
      ? stripeSubscription.customer
      : stripeSubscription.customer.id;

  let organizationId: string | undefined =
    organizationIdHint ?? stripeSubscription.metadata.organizationId;

  if (!organizationId) {
    const existing = await getSubscriptionByStripeSubscriptionId(
      supabase,
      stripeSubscription.id
    );
    organizationId = existing?.organization_id;
  }

  if (!organizationId) {
    const byCustomer = await getSubscriptionByStripeCustomerId(supabase, customerId);
    organizationId = byCustomer?.organization_id;
  }

  if (!organizationId) {
    throw new BillingError("Could not resolve organization for Stripe subscription.");
  }

  const { plan, interval } = planFromSubscription(stripeSubscription);
  const priceId = stripeSubscription.items.data[0]?.price?.id ?? null;
  const billingItem = stripeSubscription.items.data[0];
  const isCanceled = stripeSubscription.status === "canceled";

  return upsertOrgSubscription(supabase, organizationId, {
    plan: isCanceled ? "free" : plan,
    status: isCanceled ? "active" : mapStripeStatus(stripeSubscription.status),
    billing_interval: interval,
    stripe_customer_id: customerId,
    stripe_subscription_id: isCanceled ? null : stripeSubscription.id,
    stripe_price_id: isCanceled ? null : priceId,
    current_period_start: billingItem?.current_period_start
      ? new Date(billingItem.current_period_start * 1000).toISOString()
      : null,
    current_period_end: billingItem?.current_period_end
      ? new Date(billingItem.current_period_end * 1000).toISOString()
      : null,
    cancel_at_period_end: stripeSubscription.cancel_at_period_end,
    canceled_at: stripeSubscription.canceled_at
      ? new Date(stripeSubscription.canceled_at * 1000).toISOString()
      : null,
    trial_end: stripeSubscription.trial_end
      ? new Date(stripeSubscription.trial_end * 1000).toISOString()
      : null,
  });
}

export async function handleCheckoutSessionCompleted(
  supabase: SupabaseClient,
  session: Stripe.Checkout.Session
): Promise<void> {
  const organizationId = session.metadata?.organizationId;
  if (!organizationId) {
    throw new BillingError("Checkout session missing organizationId metadata.");
  }

  const customerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id;

  if (customerId) {
    await upsertOrgSubscription(supabase, organizationId, {
      stripe_customer_id: customerId,
    });
  }

  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;

  if (!subscriptionId) {
    return;
  }

  const { getStripeClient } = await import("./stripe-client");
  const stripe = getStripeClient();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  await syncStripeSubscription(supabase, subscription, organizationId);
}

export async function resetOrgToFreePlan(
  supabase: SupabaseClient,
  organizationId: string
): Promise<void> {
  await upsertOrgSubscription(supabase, organizationId, {
    plan: "free",
    status: "active",
    billing_interval: "monthly",
    stripe_subscription_id: null,
    stripe_price_id: null,
    cancel_at_period_end: false,
    canceled_at: new Date().toISOString(),
    current_period_start: null,
    current_period_end: null,
    trial_end: null,
  });
}
