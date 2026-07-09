import { NextResponse } from "next/server";
import Stripe from "stripe";
import { BillingError } from "@/lib/billing/errors";
import { getStripeWebhookSecret } from "@/lib/billing/env";
import {
  handleCheckoutSessionCompleted,
  resetOrgToFreePlan,
  syncStripeSubscription,
} from "@/lib/billing/sync";
import { getStripeClient } from "@/lib/billing/stripe-client";
import {
  getSubscriptionByStripeSubscriptionId,
} from "@/lib/billing/repository";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    const stripe = getStripeClient();
    event = stripe.webhooks.constructEvent(body, signature, getStripeWebhookSecret());
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid webhook signature.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const supabase = createAdminClient();

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(
          supabase,
          event.data.object as Stripe.Checkout.Session
        );
        break;

      case "customer.subscription.created":
      case "customer.subscription.updated":
        await syncStripeSubscription(
          supabase,
          event.data.object as Stripe.Subscription
        );
        break;

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const existing = await getSubscriptionByStripeSubscriptionId(
          supabase,
          subscription.id
        );
        const organizationId =
          existing?.organization_id ?? subscription.metadata.organizationId;

        if (organizationId) {
          await resetOrgToFreePlan(supabase, organizationId);
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionRef = (
          invoice as Stripe.Invoice & {
            subscription?: string | { id: string } | null;
          }
        ).subscription;
        const subscriptionId =
          typeof subscriptionRef === "string"
            ? subscriptionRef
            : subscriptionRef?.id ?? null;

        if (subscriptionId) {
          const stripe = getStripeClient();
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          await syncStripeSubscription(supabase, subscription);
        }
        break;
      }

      default:
        break;
    }
  } catch (err) {
    const message = err instanceof BillingError ? err.message : "Webhook handler failed.";
    console.error("[stripe webhook]", event.type, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
