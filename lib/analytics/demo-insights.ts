import { buildDemoActivityViews } from "@/lib/audit/demo-activity-events";
import { buildFounderInsightsFromActivities } from "@/lib/analytics/founder-insights";

export const INSIGHTS_DEMO_DISCLAIMER =
  "Simulated insights — no real agent is connected yet. These numbers show how Wave protection appears once agents start acting.";

export function buildDemoFounderInsights() {
  return buildFounderInsightsFromActivities(buildDemoActivityViews(), {
    isSimulated: true,
  });
}
