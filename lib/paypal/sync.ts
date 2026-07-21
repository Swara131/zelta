import type { SupabaseClient } from "@supabase/supabase-js";
import type { BillingInterval, PlanId } from "@/lib/billing-types";
import { BillingError } from "@/lib/billing/errors";
import {
  getSubscriptionByPayPalSubscriptionId,
  upsertOrgSubscription,
  type SubscriptionRow,
} from "@/lib/billing/repository";
import { resetOrgToFreePlan } from "@/lib/billing/sync";
import { getPayPalSubscription } from "./client";
import { resolvePlanFromPayPalPlan } from "./env";
import type {
  PayPalSubscriptionEventType,
  PayPalSubscriptionResource,
  PayPalWebhookEvent,
} from "./types";

export function extractPayPalSubscriptionId(
  resource: PayPalWebhookEvent["resource"]
): string | null {
  return (
    resource.id ??
    resource.billing_agreement_id ??
    resource.subscription_id ??
    null
  );
}

export function mapPayPalStatus(
  status: string | undefined
): SubscriptionRow["status"] {
  switch (status?.toUpperCase()) {
    case "ACTIVE":
      return "active";
    case "SUSPENDED":
      return "paused";
    case "CANCELLED":
    case "EXPIRED":
      return "canceled";
    case "APPROVAL_PENDING":
    case "APPROVED":
      return "incomplete";
    default:
      return "active";
  }
}

function planFromPayPalSubscription(subscription: PayPalSubscriptionResource): {
  plan: PlanId;
  interval: BillingInterval;
} {
  const planId = subscription.plan_id;
  if (planId) {
    const resolved = resolvePlanFromPayPalPlan(planId);
    if (resolved) {
      return { plan: resolved.planId, interval: resolved.interval };
    }
  }

  return { plan: "professional", interval: "monthly" };
}

async function resolveOrganizationId(
  supabase: SupabaseClient,
  subscription: PayPalSubscriptionResource,
  subscriptionId: string,
  organizationIdHint?: string
): Promise<string> {
  if (organizationIdHint) {
    return organizationIdHint;
  }

  if (subscription.custom_id?.trim()) {
    return subscription.custom_id.trim();
  }

  const existing = await getSubscriptionByPayPalSubscriptionId(
    supabase,
    subscriptionId
  );
  if (existing?.organization_id) {
    return existing.organization_id;
  }

  throw new BillingError(
    "Could not resolve organization for PayPal subscription."
  );
}

export async function syncPayPalSubscription(
  supabase: SupabaseClient,
  subscription: PayPalSubscriptionResource,
  organizationIdHint?: string
): Promise<SubscriptionRow> {
  const subscriptionId = subscription.id;
  if (!subscriptionId) {
    throw new BillingError("PayPal subscription missing id.");
  }

  const organizationId = await resolveOrganizationId(
    supabase,
    subscription,
    subscriptionId,
    organizationIdHint
  );

  const { plan, interval } = planFromPayPalSubscription(subscription);
  const status = mapPayPalStatus(subscription.status);
  const isTerminal =
    subscription.status?.toUpperCase() === "CANCELLED" ||
    subscription.status?.toUpperCase() === "EXPIRED";

  const lastPaymentTime = subscription.billing_info?.last_payment?.time;
  const nextBillingTime = subscription.billing_info?.next_billing_time;

  return upsertOrgSubscription(supabase, organizationId, {
    plan: isTerminal ? "free" : plan,
    status: isTerminal ? "active" : status,
    billing_interval: interval,
    paypal_subscription_id: isTerminal ? null : subscriptionId,
    paypal_plan_id: isTerminal ? null : (subscription.plan_id ?? null),
    current_period_start: lastPaymentTime ?? subscription.start_time ?? null,
    current_period_end: nextBillingTime ?? null,
    cancel_at_period_end: false,
    canceled_at: isTerminal
      ? (subscription.status_update_time ?? new Date().toISOString())
      : null,
    trial_end: null,
  });
}

export async function handlePayPalSubscriptionPaymentFailed(
  supabase: SupabaseClient,
  subscriptionId: string
): Promise<SubscriptionRow> {
  const existing = await getSubscriptionByPayPalSubscriptionId(
    supabase,
    subscriptionId
  );

  if (existing) {
    return upsertOrgSubscription(supabase, existing.organization_id, {
      status: "past_due",
      paypal_subscription_id: subscriptionId,
    });
  }

  const subscription = await getPayPalSubscription(subscriptionId);
  const row = await syncPayPalSubscription(supabase, subscription);
  return upsertOrgSubscription(supabase, row.organization_id, {
    status: "past_due",
  });
}

export async function handlePayPalSubscriptionSuspended(
  supabase: SupabaseClient,
  subscription: PayPalSubscriptionResource
): Promise<SubscriptionRow> {
  const subscriptionId = subscription.id;
  if (!subscriptionId) {
    throw new BillingError("PayPal subscription missing id.");
  }

  const existing = await getSubscriptionByPayPalSubscriptionId(
    supabase,
    subscriptionId
  );

  if (existing) {
    return upsertOrgSubscription(supabase, existing.organization_id, {
      status: "paused",
      paypal_subscription_id: subscriptionId,
      paypal_plan_id: subscription.plan_id ?? existing.paypal_plan_id,
    });
  }

  return syncPayPalSubscription(supabase, {
    ...subscription,
    status: "SUSPENDED",
  });
}

export async function handlePayPalWebhookEvent(
  supabase: SupabaseClient,
  event: PayPalWebhookEvent
): Promise<void> {
  const eventType = event.event_type as PayPalSubscriptionEventType;
  const subscriptionId = extractPayPalSubscriptionId(event.resource);

  switch (eventType) {
    case "BILLING.SUBSCRIPTION.ACTIVATED": {
      const subscription = subscriptionId
        ? await getPayPalSubscription(subscriptionId)
        : event.resource;
      await syncPayPalSubscription(supabase, subscription);
      break;
    }

    case "BILLING.SUBSCRIPTION.CANCELLED":
    case "BILLING.SUBSCRIPTION.EXPIRED": {
      if (!subscriptionId) {
        throw new BillingError("PayPal subscription event missing id.");
      }

      const existing = await getSubscriptionByPayPalSubscriptionId(
        supabase,
        subscriptionId
      );

      const organizationId =
        existing?.organization_id ?? event.resource.custom_id?.trim();

      if (organizationId) {
        await resetOrgToFreePlan(supabase, organizationId);
      } else {
        throw new BillingError(
          "Could not resolve organization for canceled PayPal subscription."
        );
      }
      break;
    }

    case "BILLING.SUBSCRIPTION.SUSPENDED":
      await handlePayPalSubscriptionSuspended(supabase, event.resource);
      break;

    case "BILLING.SUBSCRIPTION.PAYMENT.FAILED": {
      if (!subscriptionId) {
        throw new BillingError("PayPal payment failed event missing subscription id.");
      }
      await handlePayPalSubscriptionPaymentFailed(supabase, subscriptionId);
      break;
    }

    default:
      break;
  }
}
