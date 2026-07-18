import Link from "next/link";
import { Sparkles } from "lucide-react";
import { PRODUCT_NAME } from "@/lib/public-branding";

interface PlanUpgradeNoticeProps {
  featureLabel?: string;
  requiredPlan?: string;
}

export default function PlanUpgradeNotice({
  featureLabel = "AI Translator",
  requiredPlan = "Professional",
}: PlanUpgradeNoticeProps) {
  return (
    <div
      className="mt-4 flex flex-col gap-3 rounded-xl border border-indigo-500/25 bg-indigo-500/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
      role="status"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-zinc-100">
          {featureLabel} requires the {requiredPlan} plan
        </p>
        <p className="mt-1 text-sm text-zinc-400">
          Upgrade to unlock {featureLabel} and other {PRODUCT_NAME} premium features on Zelta.
        </p>
      </div>
      <Link
        href="/billing"
        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition-all hover:from-violet-500 hover:to-indigo-500"
      >
        <Sparkles className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
        View plans
      </Link>
    </div>
  );
}

export function isPlanRequiredMessage(message: string): boolean {
  return /requires the .+ plan or higher/i.test(message);
}

export function requiredPlanFromMessage(message: string): string {
  const match = message.match(/requires the (\w+) plan or higher/i);
  if (!match?.[1]) return "Professional";
  return match[1].charAt(0).toUpperCase() + match[1].slice(1);
}
