import type { LucideIcon } from "lucide-react";
import {
  Home,
  Bot,
  Shield,
  ClipboardCheck,
  Bell,
  Activity,
  GitBranch,
  Upload,
  Languages,
  BarChart3,
  CreditCard,
  Settings,
  Wrench,
  Terminal,
} from "lucide-react";

export interface NavLinkItem {
  href: string;
  label: string;
  icon: LucideIcon;
  description?: string;
}

export interface NavGroupItem {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Default route when the section label is clicked directly. */
  href: string;
  children?: readonly NavLinkItem[];
}

/** Primary navigation — founder mental model. */
export const PRIMARY_NAV: readonly NavGroupItem[] = [
  {
    id: "overview",
    label: "Overview",
    icon: Home,
    href: "/dashboard",
  },
  {
    id: "agents",
    label: "My Agents",
    icon: Bot,
    href: "/integrations",
  },
  {
    id: "protection",
    label: "Protection",
    icon: Shield,
    href: "/risk",
  },
  {
    id: "approvals",
    label: "Approvals",
    icon: ClipboardCheck,
    href: "/approvals",
  },
  {
    id: "activity",
    label: "Activity",
    icon: Activity,
    href: "/audit",
  },
  {
    id: "insights",
    label: "Insights",
    icon: BarChart3,
    href: "/analytics",
  },
  {
    id: "billing",
    label: "Billing",
    icon: CreditCard,
    href: "/billing",
  },
  {
    id: "developers",
    label: "Developers",
    icon: Terminal,
    href: "/developers",
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    href: "/settings",
  },
] as const;

/** Power-user tools — kept out of the main founder nav. */
export const ADVANCED_NAV: readonly NavLinkItem[] = [
  {
    href: "/notifications",
    label: "Alerts",
    icon: Bell,
    description: "Notification delivery and history",
  },
  {
    href: "/pipeline",
    label: "Pipeline",
    icon: GitBranch,
    description: "How logs flow through Wave",
  },
  {
    href: "/upload",
    label: "Upload logs",
    icon: Upload,
    description: "Import agent logs for review",
  },
  {
    href: "/translator",
    label: "Translator",
    icon: Languages,
    description: "Turn technical logs into plain language",
  },
] as const;

export const ADVANCED_NAV_GROUP: NavGroupItem = {
  id: "advanced",
  label: "Advanced",
  icon: Wrench,
  href: "/notifications",
  children: ADVANCED_NAV,
};

/** Secondary navigation — reserved for future account shortcuts. */
export const SECONDARY_NAV: readonly NavLinkItem[] = [] as const;

/** All app routes surfaced in navigation (for active-state checks). */
export const ALL_NAV_ROUTES = [
  ...PRIMARY_NAV.flatMap((item) => [
    item.href,
    ...(item.children?.map((child) => child.href) ?? []),
  ]),
  ...ADVANCED_NAV.map((item) => item.href),
  ...SECONDARY_NAV.map((item) => item.href),
] as const;

export function matchesRoute(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isNavGroupActive(group: NavGroupItem, pathname: string): boolean {
  if (matchesRoute(pathname, group.href)) {
    return true;
  }
  return group.children?.some((child) => matchesRoute(pathname, child.href)) ?? false;
}

export function isAdvancedNavActive(pathname: string): boolean {
  return ADVANCED_NAV.some((item) => matchesRoute(pathname, item.href));
}

export function isSecondaryNavActive(href: string, pathname: string): boolean {
  return matchesRoute(pathname, href);
}
