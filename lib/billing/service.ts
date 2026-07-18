import type { SupabaseClient } from "@supabase/supabase-js";
import type { BillingData, BillingInterval, Invoice, PlanId } from "@/lib/billing-types";
import { ensureOrganization } from "@/lib/organizations/ensure-organization";
import { getAppUrl, getStripePriceId } from "./env";
import { BillingError } from "./errors";
import { buildUsageMetrics, PLAN_LABELS } from "./plans";
import { isDemoMode } from "./demo-mode";
import {
  effectivePlan,
  getOrgSubscription,
  setStripeCustomerId,
  upsertOrgSubscription,
} from "./repository";
import { getStripeClient } from "./stripe-client";
import { getOrgUsage } from "./usage";

function mapInvoiceStatus(
  status: string | null
): Invoice["status"] {
  if (status === "paid") return "paid";
  if (status === "open" || status === "draft") return "pending";
  return "failed";
}

async function fetchStripeInvoices(customerId: string): Promise<Invoice[]> {
  const stripe = getStripeClient();
  const invoices = await stripe.invoices.list({
    customer: customerId,
    limit: 12,
  });

  return invoices.data.map((invoice) => {
    const planMeta = invoice.lines.data[0]?.metadata?.planId;
    const planLabel =
      planMeta && planMeta in PLAN_LABELS
        ? PLAN_LABELS[planMeta as PlanId]
        : invoice.amount_paid > 0
          ? "Professional"
          : "Free";

    return {
      id: invoice.number ?? invoice.id,
      date: new Date((invoice.created ?? 0) * 1000).toISOString(),
      amount: (invoice.amount_paid ?? invoice.total ?? 0) / 100,
      status: mapInvoiceStatus(invoice.status),
      plan: planLabel,
      pdfUrl: invoice.invoice_pdf ?? undefined,
    };
  });
}

async function fetchPaymentMethod(customerId: string): Promise<BillingData["paymentMethod"]> {
  const stripe = getStripeClient();
  const customer = await stripe.customers.retrieve(customerId, {
    expand: ["invoice_settings.default_payment_method"],
  });

  if (customer.deleted) {
    return { brand: "Card", last4: "0000", expMonth: 1, expYear: new Date().getFullYear() };
  }

  const pm = customer.invoice_settings?.default_payment_method;
  if (!pm || typeof pm === "string") {
    return { brand: "Card", last4: "0000", expMonth: 1, expYear: new Date().getFullYear() };
  }

  if (pm.type === "card" && pm.card) {
    return {
      brand: pm.card.brand ? pm.card.brand.charAt(0).toUpperCase() + pm.card.brand.slice(1) : "Card",
      last4: pm.card.last4 ?? "0000",
      expMonth: pm.card.exp_month ?? 1,
      expYear: pm.card.exp_year ?? new Date().getFullYear(),
    };
  }

  return { brand: "Card", last4: "0000", expMonth: 1, expYear: new Date().getFullYear() };
}

export async function getBillingData(
  supabase: SupabaseClient,
  userId: string,
  userEmail: string
): Promise<BillingData> {
  const organizationId = await ensureOrganization(supabase, userId, userEmail);
  const subscription = await getOrgSubscription(supabase, organizationId);
  const plan = effectivePlan(subscription);
  const usageSnapshot = await getOrgUsage(supabase, organizationId, subscription);

  let invoices: Invoice[] = [];
  let paymentMethod = {
    brand: "Card",
    last4: "0000",
    expMonth: 1,
    expYear: new Date().getFullYear(),
  };

  if (subscription?.stripe_customer_id) {
    try {
      [invoices, paymentMethod] = await Promise.all([
        fetchStripeInvoices(subscription.stripe_customer_id),
        fetchPaymentMethod(subscription.stripe_customer_id),
      ]);
    } catch {
      invoices = [];
    }
  }

  return {
    currentPlan: plan,
    demoMode: isDemoMode(),
    interval: subscription?.billing_interval ?? "monthly",
    usage: buildUsageMetrics(plan, usageSnapshot),
    invoices,
    nextBillingDate:
      subscription?.current_period_end ??
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    paymentMethod,
  };
}

async function getOrCreateStripeCustomer(
  supabase: SupabaseClient,
  organizationId: string,
  userEmail: string,
  userName?: string | null
): Promise<string> {
  const subscription = await getOrgSubscription(supabase, organizationId);
  if (subscription?.stripe_customer_id) {
    return subscription.stripe_customer_id;
  }

  const stripe = getStripeClient();
  const customer = await stripe.customers.create({
    email: userEmail,
    name: userName ?? undefined,
    metadata: { organizationId },
  });

  await setStripeCustomerId(supabase, organizationId, customer.id);
  return customer.id;
}

export async function createCheckoutSession(
  supabase: SupabaseClient,
  params: {
    userId: string;
    userEmail: string;
    userName?: string | null;
    planId: Extract<PlanId, "professional">;
    interval: BillingInterval;
  }
): Promise<string> {
  const organizationId = await ensureOrganization(
    supabase,
    params.userId,
    params.userEmail
  );

  const customerId = await getOrCreateStripeCustomer(
    supabase,
    organizationId,
    params.userEmail,
    params.userName
  );

  const priceId = getStripePriceId(params.planId, params.interval);
  const appUrl = getAppUrl();
  const stripe = getStripeClient();

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/billing?checkout=success`,
    cancel_url: `${appUrl}/billing?checkout=canceled`,
    metadata: {
      organizationId,
      planId: params.planId,
      interval: params.interval,
    },
    subscription_data: {
      metadata: {
        organizationId,
        planId: params.planId,
        interval: params.interval,
      },
    },
    allow_promotion_codes: true,
  });

  if (!session.url) {
    throw new BillingError("Stripe did not return a checkout URL.");
  }

  await upsertOrgSubscription(supabase, organizationId, {
    stripe_customer_id: customerId,
  });

  return session.url;
}

export async function createBillingPortalSession(
  supabase: SupabaseClient,
  userId: string,
  userEmail: string
): Promise<string> {
  const organizationId = await ensureOrganization(supabase, userId, userEmail);
  const subscription = await getOrgSubscription(supabase, organizationId);

  if (!subscription?.stripe_customer_id) {
    throw new BillingError("No billing account found. Subscribe to a paid plan first.");
  }

  const stripe = getStripeClient();
  const session = await stripe.billingPortal.sessions.create({
    customer: subscription.stripe_customer_id,
    return_url: `${getAppUrl()}/billing`,
  });

  if (!session.url) {
    throw new BillingError("Stripe did not return a portal URL.");
  }

  return session.url;
}

export async function getSubscriptionSummary(
  supabase: SupabaseClient,
  userId: string,
  userEmail: string
) {
  const organizationId = await ensureOrganization(supabase, userId, userEmail);
  const subscription = await getOrgSubscription(supabase, organizationId);
  const plan = effectivePlan(subscription);
  const usage = await getOrgUsage(supabase, organizationId, subscription);

  return {
    organizationId,
    plan,
    status: subscription?.status ?? "active",
    interval: subscription?.billing_interval ?? "monthly",
    cancelAtPeriodEnd: subscription?.cancel_at_period_end ?? false,
    currentPeriodEnd: subscription?.current_period_end ?? null,
    usage: buildUsageMetrics(plan, usage),
    stripeCustomerId: subscription?.stripe_customer_id ?? null,
    stripeSubscriptionId: subscription?.stripe_subscription_id ?? null,
  };
}
