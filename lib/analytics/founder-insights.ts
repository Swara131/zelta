import type { AuditTimelineEntry } from "@/lib/audit/types";
import {
  buildFounderActivityViews,
  type ActivityTone,
  type FounderActivityView,
} from "@/lib/audit/activity-copy";
import { humanizeAgentLabel } from "@/lib/dashboard/founder-copy";

export const INSIGHTS_PAGE_QUESTION = "How is Wave protecting my AI agents?";

export interface InsightsOverview {
  totalActions: number;
  allowed: number;
  needsReview: number;
  blocked: number;
}

export interface InsightMetric {
  key: "checked" | "allowed" | "approval" | "blocked";
  label: string;
  value: number;
  explanation: string;
}

export interface ProtectionBreakdownItem {
  key: "allowed" | "review" | "blocked";
  label: string;
  value: number;
  color: string;
  explanation: string;
}

export interface TopRiskyActionRow {
  key: "refunds" | "account-changes" | "permission-changes" | "data-deletion";
  label: string;
  count: number;
  explanation: string;
}

export interface AgentProtectionRow {
  agentId: string;
  agentName: string;
  actionsChecked: number;
  approvalRate: string;
  blockedActions: number;
  protectionStatus: string;
  explanations: {
    actionsChecked: string;
    approvalRate: string;
    blockedActions: string;
    protectionStatus: string;
  };
}

export interface ImportantEvent {
  id: string;
  agentName: string;
  actionLabel: string;
  decisionLabel: string;
  reason: string;
  relativeTime: string;
  tone: ActivityTone;
}

export interface FounderInsights {
  overview: InsightsOverview;
  metrics: InsightMetric[];
  protectionBreakdown: ProtectionBreakdownItem[];
  topRiskyActions: TopRiskyActionRow[];
  agentProtection: AgentProtectionRow[];
  importantEvents: ImportantEvent[];
  hasData: boolean;
  isSimulated: boolean;
}

const BREAKDOWN_COLORS = {
  allowed: "#34d399",
  review: "#fbbf24",
  blocked: "#f87171",
} as const;

const TOP_RISKY_ACTION_DEFS: Array<Omit<TopRiskyActionRow, "count">> = [
  {
    key: "refunds",
    label: "Refunds",
    explanation: "Refund requests are checked against your limits before any money moves.",
  },
  {
    key: "account-changes",
    label: "Account changes",
    explanation: "Updates to customer accounts are paused when they could affect access or billing.",
  },
  {
    key: "permission-changes",
    label: "Permission changes",
    explanation: "Granting or changing permissions can expose sensitive systems — Wave flags these.",
  },
  {
    key: "data-deletion",
    label: "Data deletion",
    explanation: "Deleting data is irreversible, so Wave treats these attempts as high risk.",
  },
];

function countByTone(activities: FounderActivityView[]) {
  let allowed = 0;
  let needsReview = 0;
  let blocked = 0;

  for (const activity of activities) {
    switch (activity.filterCategory) {
      case "allowed":
        allowed += 1;
        break;
      case "review":
        needsReview += 1;
        break;
      case "blocked":
        blocked += 1;
        break;
      default:
        break;
    }
  }

  return { allowed, needsReview, blocked };
}

function buildOverviewMetrics(overview: InsightsOverview): InsightMetric[] {
  return [
    {
      key: "checked",
      label: "Actions Checked",
      value: overview.totalActions,
      explanation:
        "Every time an agent tries to do something important, Wave evaluates it first.",
    },
    {
      key: "allowed",
      label: "Allowed Automatically",
      value: overview.allowed,
      explanation:
        "These actions were within your rules, so the agent could proceed without asking you.",
    },
    {
      key: "approval",
      label: "Approval Requests",
      value: overview.needsReview,
      explanation:
        "Wave paused these actions and sent them to your approval queue for a human decision.",
    },
    {
      key: "blocked",
      label: "Blocked Actions",
      value: overview.blocked,
      explanation:
        "Wave stopped these completely — the agent was not allowed to perform them.",
    },
  ];
}

function classifyRiskyAction(
  activity: FounderActivityView
): TopRiskyActionRow["key"] | null {
  const label = activity.actionLabel.toLowerCase();
  const haystack = `${label} ${activity.proposedAction.toLowerCase()} ${activity.actionType}`;

  if (activity.actionType === "refund" || haystack.includes("refund")) {
    return "refunds";
  }
  if (
    haystack.includes("permission") ||
    haystack.includes("role") ||
    haystack.includes("access level")
  ) {
    return "permission-changes";
  }
  if (
    haystack.includes("account") &&
    (haystack.includes("change") || haystack.includes("update") || haystack.includes("modify"))
  ) {
    return "account-changes";
  }
  if (
    activity.actionType === "delete" ||
    haystack.includes("delete") ||
    haystack.includes("deletion") ||
    haystack.includes("wipe")
  ) {
    return "data-deletion";
  }

  return null;
}

function buildTopRiskyActions(activities: FounderActivityView[]): TopRiskyActionRow[] {
  const counts = new Map<TopRiskyActionRow["key"], number>(
    TOP_RISKY_ACTION_DEFS.map((def) => [def.key, 0])
  );

  for (const activity of activities) {
    const category = classifyRiskyAction(activity);
    if (category) {
      counts.set(category, (counts.get(category) ?? 0) + 1);
    }
  }

  return TOP_RISKY_ACTION_DEFS.map((def) => ({
    ...def,
    count: counts.get(def.key) ?? 0,
  })).sort((a, b) => b.count - a.count);
}

function deriveProtectionStatus(
  actionsChecked: number,
  reviews: number,
  blocked: number
): { label: string; explanation: string } {
  if (actionsChecked === 0) {
    return {
      label: "Waiting for activity",
      explanation: "Wave is ready — protection starts when the agent proposes its first action.",
    };
  }

  if (blocked > 0 && blocked / actionsChecked >= 0.25) {
    return {
      label: "Needs attention",
      explanation:
        "This agent tried several actions Wave blocked. Review your rules or agent behavior.",
    };
  }

  if (reviews > 0 && reviews / actionsChecked >= 0.5) {
    return {
      label: "High review rate",
      explanation:
        "Many actions need your approval. Consider adjusting rules if this feels too frequent.",
    };
  }

  return {
    label: "Protected",
    explanation:
      "Wave is actively checking this agent's actions against your protection rules.",
  };
}

function buildAgentProtection(activities: FounderActivityView[]): AgentProtectionRow[] {
  const byAgent = new Map<
    string,
    { agentName: string; actions: number; reviews: number; blocked: number }
  >();

  for (const activity of activities) {
    const existing = byAgent.get(activity.agentId) ?? {
      agentName: activity.agentName,
      actions: 0,
      reviews: 0,
      blocked: 0,
    };

    existing.actions += 1;
    if (activity.filterCategory === "review") {
      existing.reviews += 1;
    }
    if (activity.filterCategory === "blocked") {
      existing.blocked += 1;
    }

    byAgent.set(activity.agentId, existing);
  }

  return [...byAgent.entries()]
    .map(([agentId, stats]) => {
      const approvalRate =
        stats.actions === 0
          ? "—"
          : `${Math.round((stats.reviews / stats.actions) * 100)}%`;
      const status = deriveProtectionStatus(stats.actions, stats.reviews, stats.blocked);

      return {
        agentId,
        agentName: stats.agentName,
        actionsChecked: stats.actions,
        approvalRate,
        blockedActions: stats.blocked,
        protectionStatus: status.label,
        explanations: {
          actionsChecked: "How many actions Wave evaluated for this agent.",
          approvalRate:
            stats.reviews === 0
              ? "None of this agent's checked actions needed your approval yet."
              : "Share of checked actions that Wave paused for your approval.",
          blockedActions:
            stats.blocked === 0
              ? "No blocked attempts — nothing was stopped for this agent."
              : "Actions Wave prevented this agent from completing.",
          protectionStatus: status.explanation,
        },
      };
    })
    .sort((a, b) => b.actionsChecked - a.actionsChecked);
}

function buildImportantEvents(activities: FounderActivityView[]): ImportantEvent[] {
  return activities
    .filter(
      (activity) =>
        activity.filterCategory === "review" || activity.filterCategory === "blocked"
    )
    .slice(0, 6)
    .map((activity) => ({
      id: activity.id,
      agentName: activity.agentName,
      actionLabel: activity.actionLabel,
      decisionLabel: activity.decisionLabel,
      reason: activity.reason,
      relativeTime: activity.relativeTime,
      tone: activity.tone,
    }));
}

export function buildFounderInsightsFromActivities(
  activities: FounderActivityView[],
  options: { isSimulated?: boolean } = {}
): FounderInsights {
  const { allowed, needsReview, blocked } = countByTone(activities);
  const totalActions = activities.length;

  const overview: InsightsOverview = {
    totalActions,
    allowed,
    needsReview,
    blocked,
  };

  const protectionBreakdown: ProtectionBreakdownItem[] = [
    {
      key: "allowed",
      label: "Allowed",
      value: allowed,
      color: BREAKDOWN_COLORS.allowed,
      explanation: "Actions that passed your rules and ran without waiting for you.",
    },
    {
      key: "review",
      label: "Approval Required",
      value: needsReview,
      color: BREAKDOWN_COLORS.review,
      explanation: "Actions Wave paused so you could approve or reject them.",
    },
    {
      key: "blocked",
      label: "Blocked",
      value: blocked,
      color: BREAKDOWN_COLORS.blocked,
      explanation: "Actions Wave stopped before the agent could complete them.",
    },
  ];

  return {
    overview,
    metrics: buildOverviewMetrics(overview),
    protectionBreakdown,
    topRiskyActions: buildTopRiskyActions(activities),
    agentProtection: buildAgentProtection(activities),
    importantEvents: buildImportantEvents(activities),
    hasData: totalActions > 0,
    isSimulated: options.isSimulated ?? false,
  };
}

export function buildFounderInsights(
  auditEntries: AuditTimelineEntry[],
  now = Date.now()
): FounderInsights {
  const activities = buildFounderActivityViews(auditEntries, now);
  return buildFounderInsightsFromActivities(activities);
}

/** Useful when audit entries lack agent metadata but keys exist. */
export function mergeAgentProtectionRows(
  rows: AgentProtectionRow[],
  agentIds: string[]
): AgentProtectionRow[] {
  const existing = new Set(rows.map((row) => row.agentId));
  const merged = [...rows];

  for (const agentId of agentIds) {
    if (!existing.has(agentId)) {
      const status = deriveProtectionStatus(0, 0, 0);
      merged.push({
        agentId,
        agentName: humanizeAgentLabel(agentId),
        actionsChecked: 0,
        approvalRate: "—",
        blockedActions: 0,
        protectionStatus: status.label,
        explanations: {
          actionsChecked: "How many actions Wave evaluated for this agent.",
          approvalRate: "Share of checked actions that Wave paused for your approval.",
          blockedActions: "Actions Wave prevented this agent from completing.",
          protectionStatus: status.explanation,
        },
      });
    }
  }

  return merged.sort((a, b) => b.actionsChecked - a.actionsChecked);
}
