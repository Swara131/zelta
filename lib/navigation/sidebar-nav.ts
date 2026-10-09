import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Bot,
  ClipboardCheck,
  CreditCard,
  Home,
  LayoutTemplate,
  Scale,
  Settings,
  Shield,
  Users,
} from "lucide-react";

export interface SidebarNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Match child routes (default true). Set false for /agents vs /agents/create. */
  matchPrefix?: boolean;
}

export const SIDEBAR_PRIMARY_NAV: readonly SidebarNavItem[] = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/agents/platform", label: "Agents", icon: Bot },
  { href: "/templates", label: "Templates", icon: LayoutTemplate },
  { href: "/integrations", label: "My Agents", icon: Users },
  { href: "/decision-agents", label: "Multiple Decision Agents", icon: Scale },
  { href: "/monitor", label: "Monitor", icon: Activity },
  { href: "/approvals", label: "Approvals", icon: ClipboardCheck },
  { href: "/safety", label: "Safety", icon: Shield },
] as const;

export const SIDEBAR_SECONDARY_NAV: readonly SidebarNavItem[] = [
  { href: "/billing", label: "Pricing", icon: CreditCard },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function isSidebarNavActive(
  pathname: string,
  href: string,
  matchPrefix = true
): boolean {
  if (pathname === href) return true;

  if (href === "/agents/platform") {
    return (
      pathname.startsWith("/agents") &&
      !pathname.startsWith("/agents/templates") &&
      !pathname.startsWith("/dashboard/templates") &&
      !pathname.startsWith("/templates")
    );
  }

  if (!matchPrefix) return false;
  return pathname.startsWith(`${href}/`);
}
