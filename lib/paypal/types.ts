export type PayPalSubscriptionStatus =
  | "APPROVAL_PENDING"
  | "APPROVED"
  | "ACTIVE"
  | "SUSPENDED"
  | "CANCELLED"
  | "EXPIRED";

export type PayPalMoneyAmount = {
  currency_code?: string;
  value?: string;
};

export type PayPalSubscriptionResource = {
  id?: string;
  plan_id?: string;
  status?: PayPalSubscriptionStatus | string;
  custom_id?: string;
  start_time?: string;
  status_update_time?: string;
  create_time?: string;
  update_time?: string;
  billing_info?: {
    next_billing_time?: string;
    last_payment?: {
      time?: string;
      amount?: PayPalMoneyAmount;
    };
    failed_payments_count?: number;
  };
};

export type PayPalWebhookEvent = {
  id: string;
  event_type: string;
  resource_type?: string;
  resource: PayPalSubscriptionResource & {
    billing_agreement_id?: string;
    subscription_id?: string;
  };
  create_time?: string;
};

export type PayPalWebhookVerificationStatus = "SUCCESS" | "FAILURE";

export type PayPalVerifyWebhookResponse = {
  verification_status: PayPalWebhookVerificationStatus;
};

export const PAYPAL_SUBSCRIPTION_EVENTS = [
  "BILLING.SUBSCRIPTION.ACTIVATED",
  "BILLING.SUBSCRIPTION.CANCELLED",
  "BILLING.SUBSCRIPTION.SUSPENDED",
  "BILLING.SUBSCRIPTION.EXPIRED",
  "BILLING.SUBSCRIPTION.PAYMENT.FAILED",
] as const;

export type PayPalSubscriptionEventType =
  (typeof PAYPAL_SUBSCRIPTION_EVENTS)[number];
