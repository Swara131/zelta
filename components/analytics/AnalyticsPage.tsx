"use client";

import { useEffect, useState } from "react";
import {
  BarChart3,
  Zap,
  ShieldBan,
  Clock,
  CheckCircle2,
  Calendar,
  Download,
} from "lucide-react";
import PageShell from "@/components/ui/PageShell";
import PageHeader from "@/components/ui/PageHeader";
import { PageHeaderBadges } from "@/components/ui/DemoModeBadge";
import SectionHeader from "@/components/ui/SectionHeader";
import Button from "@/components/ui/Button";
import MetricCard from "./MetricCard";
import AnalyticsPieChart from "./AnalyticsPieChart";
import AnalyticsAreaChart from "./AnalyticsAreaChart";
import AnalyticsLineChart from "./AnalyticsLineChart";
import ActivityHeatmap from "./ActivityHeatmap";
import UserRankList from "./UserRankList";
import DepartmentTable from "./DepartmentTable";
import RecentActivityFeed from "./RecentActivityFeed";
import type { AnalyticsData } from "@/lib/analytics-types";
import { DUMMY_ANALYTICS } from "@/lib/dummy-analytics";

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData>(DUMMY_ANALYTICS);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      try {
        const response = await fetch("/api/analytics/dashboard");
        if (!response.ok) return;
        const payload = (await response.json()) as AnalyticsData;
        if (!cancelled && payload.kpis) {
          setData(payload);
        }
      } catch {
        /* keep fallback data */
      }
    }

    void loadDashboard();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "analytics-report.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <PageShell>
      <PageHeader
        icon={BarChart3}
        title="Analytics"
        description="Executive dashboard for agent action monitoring and approval performance."
        badge={
          <PageHeaderBadges>
            <span className="ds-badge ds-badge-success">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" aria-hidden="true" />
              Live
            </span>
          </PageHeaderBadges>
        }
        actions={
          <Button variant="secondary" size="sm" icon={Download} onClick={handleExport}>
            Export
          </Button>
        }
      />

      <section className="ds-section grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Key metrics">
        <MetricCard kpi={data.kpis.todaysActions} icon={Zap} accent="#635bff" />
        <MetricCard kpi={data.kpis.blockedActions} icon={ShieldBan} accent="#f87171" />
        <MetricCard kpi={data.kpis.approvalTime} icon={Clock} accent="#06b6d4" />
        <MetricCard kpi={data.kpis.successRate} icon={CheckCircle2} accent="#34d399" />
      </section>

      <section className="ds-section grid grid-cols-1 gap-4 lg:grid-cols-2" aria-label="Trend charts">
        <AnalyticsAreaChart
          title="Weekly Trends"
          subtitle="Actions and blocked events — last 7 days"
          data={data.weeklyTrend}
        />
        <AnalyticsLineChart
          title="Monthly Trends"
          subtitle="6-month action volume"
          data={data.monthlyTrend}
        />
      </section>

      <section className="ds-section grid grid-cols-1 gap-4 lg:grid-cols-3" aria-label="Distribution and activity">
        <AnalyticsPieChart
          title="Departments"
          subtitle="Action volume by team"
          data={data.departmentPie}
        />
        <AnalyticsPieChart
          title="Approval Outcomes"
          subtitle="Action disposition breakdown"
          data={data.actionTypePie}
        />
        <ActivityHeatmap data={data.heatmap} />
      </section>

      <section className="ds-section grid grid-cols-1 gap-4 lg:grid-cols-3" aria-label="Users and departments">
        <UserRankList
          title="Top Risky Users"
          users={data.topRiskyUsers}
          variant="risky"
        />
        <UserRankList
          title="Most Active Users"
          users={data.mostActiveUsers}
          variant="active"
        />
        <DepartmentTable departments={data.departments} />
      </section>

      <section className="ds-section" aria-label="Recent activity">
        <SectionHeader icon={Calendar} title="Activity Feed" />
        <RecentActivityFeed items={data.recentActivity} />
      </section>
    </PageShell>
  );
}
