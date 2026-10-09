"use client";

import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Ban, Bell, ShieldCheck, TrendingUp } from "lucide-react";
import type { SafetyOverviewStats as SafetyOverviewStatsData } from "@/lib/safety/center/types";

type StatTone = "green" | "blue" | "orange" | "red" | "purple";

interface StatConfig {
  tone: StatTone;
  icon: LucideIcon;
  label: string;
  hint: string;
  value: number;
  delay: number;
}

function PremiumStatCard({ tone, icon: Icon, label, hint, value, delay }: StatConfig) {
  return (
    <article
      className={`sc-stat-card sc-stat-${tone}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="sc-stat-card-inner">
        <div className="sc-stat-icon-wrap" aria-hidden="true">
          <Icon className="sc-stat-icon" strokeWidth={2} />
        </div>
        <div className="sc-stat-copy">
          <p className="sc-stat-number">{value.toLocaleString()}</p>
          <p className="sc-stat-label">{label}</p>
          <p className="sc-stat-hint">{hint}</p>
        </div>
      </div>
    </article>
  );
}

export default function SafetyOverviewStats({ overview }: { overview: SafetyOverviewStatsData }) {
  const stats: StatConfig[] = [
    {
      tone: "green",
      icon: ShieldCheck,
      label: "Protected Agents",
      hint: "Agents with Wave protection active",
      value: overview.protectedAgents,
      delay: 0,
    },
    {
      tone: "blue",
      icon: TrendingUp,
      label: "Actions Allowed",
      hint: "Last 30 days",
      value: overview.actionsAllowed,
      delay: 60,
    },
    {
      tone: "orange",
      icon: AlertTriangle,
      label: "Approval Required",
      hint: "Pending your review",
      value: overview.actionsRequireApproval,
      delay: 120,
    },
    {
      tone: "red",
      icon: Ban,
      label: "Actions Blocked",
      hint: "Last 30 days",
      value: overview.actionsBlocked,
      delay: 180,
    },
    {
      tone: "purple",
      icon: Bell,
      label: "Active Safety Issues",
      hint: "Pending approvals waiting now",
      value: overview.activeSafetyIssues,
      delay: 240,
    },
  ];

  return (
    <section className="sc-overview" aria-labelledby="sc-overview-heading">
      <h2 id="sc-overview-heading" className="sc-section-title">
        Safety overview
      </h2>
      <div className="sc-stat-grid">
        {stats.map((stat) => (
          <PremiumStatCard key={stat.label} {...stat} />
        ))}
      </div>
    </section>
  );
}
