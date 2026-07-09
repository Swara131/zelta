import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlanId } from "@/lib/billing-types";
import { BillingError, UsageLimitError } from "./errors";
import { PLAN_LIMITS } from "./plans";
import type { SubscriptionRow } from "./repository";
import { effectivePlan } from "./repository";

export interface OrgUsage {
  apiCalls: number;
  storageMb: number;
  users: number;
}

function periodStart(subscription: SubscriptionRow | null): string {
  if (subscription?.current_period_start) {
    return subscription.current_period_start;
  }
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  return start.toISOString();
}

export async function getOrgUsage(
  supabase: SupabaseClient,
  organizationId: string,
  subscription: SubscriptionRow | null
): Promise<OrgUsage> {
  const since = periodStart(subscription);

  const [auditCount, storageBytes, memberCount] = await Promise.all([
    supabase
      .from("audit_logs")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .gte("created_at", since)
      .then(({ count, error }) => {
        if (error) throw new BillingError(error.message);
        return count ?? 0;
      }),
    supabase
      .from("uploaded_logs")
      .select("file_size_bytes")
      .eq("organization_id", organizationId)
      .then(({ data, error }) => {
        if (error) throw new BillingError(error.message);
        return (data ?? []).reduce(
          (sum, row) => sum + Number(row.file_size_bytes ?? 0),
          0
        );
      }),
    supabase
      .from("organization_members")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .then(({ count, error }) => {
        if (error) throw new BillingError(error.message);
        return count ?? 0;
      }),
  ]);

  return {
    apiCalls: auditCount,
    storageMb: Math.ceil(storageBytes / (1024 * 1024)),
    users: memberCount,
  };
}

export function isWithinLimit(
  plan: PlanId,
  metric: keyof OrgUsage,
  used: number,
  additional = 0
): boolean {
  const limits = PLAN_LIMITS[plan];
  const key =
    metric === "apiCalls"
      ? "apiCalls"
      : metric === "storageMb"
        ? "storageMb"
        : "users";
  return used + additional <= limits[key];
}

export async function assertUsageCapacity(
  supabase: SupabaseClient,
  organizationId: string,
  subscription: SubscriptionRow | null,
  metric: keyof OrgUsage,
  additional = 0
): Promise<OrgUsage> {
  const plan = effectivePlan(subscription);
  const usage = await getOrgUsage(supabase, organizationId, subscription);

  if (!isWithinLimit(plan, metric, usage[metric], additional)) {
    throw new UsageLimitError(metric);
  }

  return usage;
}
