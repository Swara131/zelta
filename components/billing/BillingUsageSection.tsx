"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, BarChart3, Bot, Check, CheckCircle2 } from "lucide-react";
import type { BillingInterval } from "@/lib/billing-types";
import {
  USAGE_DASHBOARD_INCLUDED,
  usagePeriodLabel,
  type FounderUsageItem,
  type UsageMetricKind,
} from "@/lib/billing/founder-billing-copy";

interface BillingUsageSectionProps {
  usage: FounderUsageItem[];
  loading?: boolean;
  interval: BillingInterval;
}

interface MetricCardView {
  kind: UsageMetricKind;
  title: string;
  icon: ReactNode;
  used: number;
  limit: number;
  helperText: string;
  footnote: string;
  fillVariant: "blue" | "green" | "orange" | "gradient";
  showUpgrade: boolean;
  unlimited: boolean;
}

function metricKindFromLabel(label: string): UsageMetricKind {
  if (label === "Agents") return "agents";
  if (label === "Approval requests") return "approvals";
  return "actions";
}

function buildMetricCards(
  metrics: FounderUsageItem[],
  interval: BillingInterval
): MetricCardView[] {
  const period = usagePeriodLabel(interval);

  return metrics.map((metric) => {
    const kind = metricKindFromLabel(metric.label);
    const unlimited = metric.label === "Agents" && metric.limit >= 999;
    const overLimit = !unlimited && metric.used > metric.limit;
    const ratio = metric.limit > 0 ? metric.used / metric.limit : 0;

    if (kind === "actions") {
      return {
        kind,
        title: "Actions Monitored",
        icon: <BarChart3 className="h-5 w-5" strokeWidth={2} aria-hidden="true" />,
        used: metric.used,
        limit: metric.limit,
        helperText: metric.helperText,
        footnote: `Cost: ₹0 this ${period} (included)`,
        fillVariant: "blue",
        showUpgrade: false,
        unlimited: false,
      };
    }

    if (kind === "agents") {
      const multiplier =
        metric.limit > 0 ? Math.max(1, Math.round(metric.used / metric.limit)) : metric.used;
      return {
        kind,
        title: "Agents Connected",
        icon: <Bot className="h-5 w-5" strokeWidth={2} aria-hidden="true" />,
        used: metric.used,
        limit: metric.limit,
        helperText: overLimit
          ? `You're using ${multiplier}x your plan limit`
          : metric.helperText,
        footnote: overLimit
          ? "Upgrade to unlock more agent slots on Growth."
          : "Each connected agent routes actions through Wave.",
        fillVariant: overLimit ? "orange" : "gradient",
        showUpgrade: overLimit || metric.used >= metric.limit,
        unlimited,
      };
    }

    return {
      kind,
      title: "Approval Requests",
      icon: <Check className="h-5 w-5" strokeWidth={2} aria-hidden="true" />,
      used: metric.used,
      limit: metric.limit,
      helperText:
        ratio <= 0.25
          ? "Low usage = low monthly cost"
          : metric.helperText,
      footnote:
        ratio <= 0.25
          ? "You're in the efficiency zone ✓"
          : "Human reviews only when risk rules require it.",
      fillVariant: "green",
      showUpgrade: false,
      unlimited: false,
    };
  });
}

function UsageMetricCard({
  card,
  animate,
}: {
  card: MetricCardView;
  animate: boolean;
}) {
  const pctRaw = card.limit > 0 ? (card.used / card.limit) * 100 : 0;
  const pctDisplay = Math.min(pctRaw, 100);
  const targetWidth = Math.max(pctDisplay, card.used === 0 ? 0 : 4);
  const overLimit = card.used > card.limit && !card.unlimited;
  const displayLimit = card.unlimited ? "Unlimited" : card.limit.toLocaleString();

  return (
    <article className={`bill-usage-metric-card ${overLimit ? "bill-usage-metric-card-over" : ""}`}>
      <div className="bill-usage-metric-icon" aria-hidden="true">
        {card.icon}
      </div>

      <h4 className="bill-usage-metric-title">{card.title}</h4>

      <p className="bill-usage-metric-value">
        {card.used.toLocaleString()}
        <span className="bill-usage-metric-limit"> / {displayLimit}</span>
      </p>

      {!card.unlimited ? (
        <div
          className="bill-usage-metric-track-wrap"
          title={`${Math.round(pctRaw)}% used`}
        >
          <div
            className="bill-usage-metric-track"
            role="progressbar"
            aria-valuenow={card.used}
            aria-valuemin={0}
            aria-valuemax={card.limit}
            aria-label={`${card.title}: ${card.used} of ${card.limit}`}
          >
            <div
              className={`bill-usage-metric-fill bill-usage-metric-fill-${card.fillVariant} ${
                animate ? "bill-usage-metric-fill-animate" : ""
              } ${overLimit ? "bill-usage-metric-fill-over" : ""}`}
              style={{ ["--bill-usage-target" as string]: `${targetWidth}%` }}
            />
          </div>
          <span className="bill-usage-metric-tooltip" role="tooltip">
            {Math.round(pctRaw)}% used
          </span>
        </div>
      ) : null}

      <p className="bill-usage-metric-helper">{card.helperText}</p>
      <p className="bill-usage-metric-footnote">{card.footnote}</p>

      {card.showUpgrade ? (
        <Link href="#bill-plans-heading" className="bill-usage-metric-upgrade">
          Upgrade to Growth
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
        </Link>
      ) : null}
    </article>
  );
}

export default function BillingUsageSection({
  usage,
  loading,
  interval,
}: BillingUsageSectionProps) {
  const heading =
    interval === "yearly" ? "Your consumption this year" : "Your consumption this month";
  const [animateBars, setAnimateBars] = useState(false);

  const metricCards = useMemo(
    () => buildMetricCards(usage, interval),
    [usage, interval]
  );

  useEffect(() => {
    if (loading) {
      setAnimateBars(false);
      return;
    }
    const timer = window.setTimeout(() => setAnimateBars(true), 80);
    return () => window.clearTimeout(timer);
  }, [loading, interval]);

  return (
    <section
      className="bill-usage-dashboard"
      aria-labelledby="bill-usage-heading"
    >
      <div className="bill-usage-dashboard-inner">
        <header className="bill-usage-dashboard-head">
          <h3 id="bill-usage-heading" className="bill-usage-dashboard-title">
            {heading}
          </h3>
          <p className="bill-usage-dashboard-subtitle">
            <CheckCircle2
              className="bill-usage-dashboard-subicon"
              strokeWidth={2.25}
              aria-hidden="true"
            />
            Transparent usage tracking — no hidden overages
          </p>
        </header>

        {loading ? (
          <p className="bill-usage-loading">Loading usage…</p>
        ) : (
          <>
            <div className="bill-usage-metric-grid">
              {metricCards.map((card) => (
                <UsageMetricCard
                  key={card.kind}
                  card={card}
                  animate={animateBars}
                />
              ))}
            </div>

            <div className="bill-usage-included">
              <h4 className="bill-usage-included-title">What&apos;s included</h4>
              <ul className="bill-usage-included-list">
                {USAGE_DASHBOARD_INCLUDED.map((item) => (
                  <li key={item}>
                    <Check className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <p className="bill-usage-upgrade-callout">
              Need more capacity?{" "}
              <Link href="#bill-plans-heading" className="bill-usage-upgrade-callout-link">
                View Growth plan
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
              </Link>
            </p>
          </>
        )}
      </div>
    </section>
  );
}
