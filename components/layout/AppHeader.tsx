"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import LogoutButton from "@/components/auth/LogoutButton";
import Soc2ComplianceBadge from "@/components/trust/Soc2ComplianceBadge";
import {
  COMPANY_NAME,
  DASHBOARD_SUBTITLE,
} from "@/lib/public-branding";
import {
  Shield,
  Menu,
  X,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { DASHBOARD_ROUTE } from "@/lib/auth/routes";
import {
  PRIMARY_NAV,
  ADVANCED_NAV_GROUP,
  SECONDARY_NAV,
  isNavGroupActive,
  isAdvancedNavActive,
  isSecondaryNavActive,
  matchesRoute,
  type NavGroupItem,
  type NavLinkItem,
} from "@/lib/navigation/app-nav";
import { formatNavBadge } from "@/lib/navigation/nav-status";
import { useNavStatus } from "@/hooks/useNavStatus";
import CreateAgentButton from "@/components/ui/CreateAgentButton";

function NavDropdownPanel({
  items,
  pathname,
  onNavigate,
}: {
  items: readonly NavLinkItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="app-header-dropdown absolute left-0 top-full z-50 mt-2 min-w-[14rem] rounded-[var(--ds-radius-md)] border border-[var(--ds-border)] bg-[var(--ds-bg-elevated)] p-1.5 shadow-[var(--ds-shadow-lg)]">
      {items.map(({ href, label, icon: Icon, description }) => {
        const active = matchesRoute(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`flex items-start gap-2.5 rounded-[var(--ds-radius-sm)] px-3 py-2 transition-colors ${
              active
                ? "bg-[var(--ds-brand-muted)] text-[#a5b4fc]"
                : "text-[var(--ds-text-secondary)] hover:bg-[var(--ds-bg-subtle)] hover:text-[var(--ds-text-primary)]"
            }`}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
            <span className="min-w-0">
              <span className="block text-sm font-medium">{label}</span>
              {description ? (
                <span className="mt-0.5 block text-xs text-[var(--ds-text-tertiary)]">
                  {description}
                </span>
              ) : null}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

export default function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const navStatus = useNavStatus();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [mobileExpandedId, setMobileExpandedId] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const dropdownRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    setOpenDropdownId(null);
    setMobileOpen(false);
    setMobileExpandedId(null);
  }, [pathname]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const clickedInside = Object.values(dropdownRefs.current).some(
        (node) => node && node.contains(event.target as Node)
      );
      if (!clickedInside) {
        setOpenDropdownId(null);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMobileLogout = async () => {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    setMobileOpen(false);
    router.push("/login");
    router.refresh();
  };

  const renderPrimaryLink = (
    group: NavGroupItem,
    active: boolean,
    onNavigate?: () => void
  ) => {
    const Icon = group.icon;
    const badge = formatNavBadge(group.id, navStatus);
    return (
      <Link
        href={group.href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={`ds-tab inline-flex items-center gap-1.5 ${active ? "ds-tab-active" : ""}`}
      >
        <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
        {group.label}
        {badge ? <span className="app-nav-badge">{badge}</span> : null}
      </Link>
    );
  };

  const renderPrimaryDropdown = (group: NavGroupItem, active: boolean) => {
    const Icon = group.icon;
    const isOpen = openDropdownId === group.id;
    const badge = formatNavBadge(group.id, navStatus);

    return (
      <div
        className="relative"
        ref={(node) => {
          dropdownRefs.current[group.id] = node;
        }}
      >
        <div
          className={`inline-flex items-stretch overflow-hidden rounded-[var(--ds-radius-sm)] ${
            active ? "bg-[var(--ds-brand-muted)]" : ""
          }`}
        >
          <Link
            href={group.href}
            aria-current={matchesRoute(pathname, group.href) ? "page" : undefined}
            className={`ds-tab inline-flex items-center gap-1.5 rounded-r-none border-r border-[var(--ds-border)] pr-2 ${
              active ? "ds-tab-active" : ""
            }`}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
            {group.label}
            {badge ? <span className="app-nav-badge">{badge}</span> : null}
          </Link>
          <button
            type="button"
            className={`ds-tab inline-flex items-center rounded-l-none px-1.5 ${
              active ? "ds-tab-active" : ""
            }`}
            aria-expanded={isOpen}
            aria-haspopup="true"
            aria-label={`${group.label} menu`}
            onClick={() => setOpenDropdownId(isOpen ? null : group.id)}
          >
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`}
              strokeWidth={2}
              aria-hidden="true"
            />
          </button>
        </div>

        {isOpen && group.children ? (
          <NavDropdownPanel
            items={group.children}
            pathname={pathname}
            onNavigate={() => setOpenDropdownId(null)}
          />
        ) : null}
      </div>
    );
  };

  const renderSecondaryLink = (
    item: NavLinkItem,
    active: boolean,
    onNavigate?: () => void
  ) => {
    const Icon = item.icon;
    return (
      <Link
        href={item.href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={`app-header-secondary-link ${active ? "app-header-secondary-link-active" : ""}`}
      >
        <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
        {item.label}
      </Link>
    );
  };

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--ds-border)] bg-[var(--ds-bg-elevated)]/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Link
          href={DASHBOARD_ROUTE}
          className="flex min-w-0 shrink-0 items-center gap-2.5 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-brand)]"
          aria-label={`${COMPANY_NAME} dashboard home`}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--ds-radius-sm)] bg-[var(--ds-brand)] shadow-[var(--ds-shadow-brand)]">
            <Shield className="h-5 w-5 text-white" strokeWidth={2} aria-hidden="true" />
          </div>
          <div className="hidden min-w-0 sm:block">
            <p className="text-sm font-semibold tracking-tight text-[var(--ds-text-primary)]">
              {COMPANY_NAME}
            </p>
            <p className="text-[11px] text-[var(--ds-text-tertiary)]">{DASHBOARD_SUBTITLE}</p>
          </div>
        </Link>

        <div className="hidden items-center gap-2 md:flex">
          <CreateAgentButton size="sm" />
          <Soc2ComplianceBadge />
          <LogoutButton />
        </div>

        <button
          type="button"
          className="ds-btn ds-btn-ghost ds-btn-icon shrink-0 md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <nav
        className="app-header-nav hidden border-t border-[var(--ds-border)] md:block"
        aria-label="Main navigation"
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="ds-tabs app-header-tabs flex min-w-0 flex-1 flex-wrap items-center gap-1 py-2">
            {PRIMARY_NAV.map((group) => {
              const active = isNavGroupActive(group, pathname);
              if (group.children?.length) {
                return (
                  <div key={group.id}>{renderPrimaryDropdown(group, active)}</div>
                );
              }
              return (
                <div key={group.id}>{renderPrimaryLink(group, active)}</div>
              );
            })}
            <div key={ADVANCED_NAV_GROUP.id}>
              {renderPrimaryDropdown(
                ADVANCED_NAV_GROUP,
                isAdvancedNavActive(pathname)
              )}
            </div>
          </div>

          {SECONDARY_NAV.length > 0 ? (
          <div
            className="app-header-secondary hidden shrink-0 items-center gap-1 border-l border-[var(--ds-border)] pl-3 md:flex"
            aria-label="Account navigation"
          >
            {SECONDARY_NAV.map((item) =>
              renderSecondaryLink(item, isSecondaryNavActive(item.href, pathname))
            )}
          </div>
          ) : null}
        </div>
      </nav>

      {mobileOpen && (
        <nav
          id="mobile-nav"
          className="border-t border-[var(--ds-border)] bg-[var(--ds-bg-elevated)] px-4 py-3 md:hidden"
          aria-label="Mobile navigation"
        >
          <div className="mb-3 px-1">
            <CreateAgentButton className="w-full justify-center" />
          </div>

          <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--ds-text-tertiary)]">
            Main
          </p>
          <ul className="grid grid-cols-2 gap-1">
            {PRIMARY_NAV.map((group) => {
              const active = isNavGroupActive(group, pathname);
              const Icon = group.icon;

              if (!group.children?.length) {
                return (
                  <li key={group.id}>
                    <Link
                      href={group.href}
                      onClick={() => setMobileOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-2 rounded-[var(--ds-radius-sm)] px-3 py-2.5 text-sm font-medium transition-colors ${
                        active
                          ? "bg-[var(--ds-brand-muted)] text-[#a5b4fc]"
                          : "text-[var(--ds-text-secondary)] hover:bg-[var(--ds-bg-subtle)]"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
                      {group.label}
                    </Link>
                  </li>
                );
              }

              const expanded = mobileExpandedId === group.id;
              return (
                <li key={group.id} className="col-span-2">
                  <button
                    type="button"
                    onClick={() =>
                      setMobileExpandedId(expanded ? null : group.id)
                    }
                    className={`flex w-full items-center justify-between rounded-[var(--ds-radius-sm)] px-3 py-2.5 text-sm font-medium transition-colors ${
                      active
                        ? "bg-[var(--ds-brand-muted)] text-[#a5b4fc]"
                        : "text-[var(--ds-text-secondary)] hover:bg-[var(--ds-bg-subtle)]"
                    }`}
                    aria-expanded={expanded}
                  >
                    <span className="flex items-center gap-2">
                      <Icon className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
                      {group.label}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                  </button>

                  {expanded ? (
                    <ul className="mt-1 space-y-0.5 pl-3">
                      {group.children.map((child) => {
                        const childActive = matchesRoute(pathname, child.href);
                        const ChildIcon = child.icon;
                        return (
                          <li key={child.href}>
                            <Link
                              href={child.href}
                              onClick={() => setMobileOpen(false)}
                              aria-current={childActive ? "page" : undefined}
                              className={`ml-4 flex items-center gap-2 rounded-[var(--ds-radius-sm)] px-3 py-2 text-sm font-medium transition-colors ${
                                childActive
                                  ? "bg-[var(--ds-brand-muted)] text-[#a5b4fc]"
                                  : "text-[var(--ds-text-secondary)] hover:bg-[var(--ds-bg-subtle)]"
                              }`}
                            >
                              <ChildIcon
                                className="h-4 w-4 shrink-0"
                                strokeWidth={2}
                                aria-hidden="true"
                              />
                              {child.label}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>

          <p className="mb-2 mt-4 px-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--ds-text-tertiary)]">
            Advanced
          </p>
          <ul className="space-y-0.5">
            {ADVANCED_NAV_GROUP.children?.map((item) => {
              const active = matchesRoute(pathname, item.href);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-2 rounded-[var(--ds-radius-sm)] px-3 py-2.5 text-sm font-medium transition-colors ${
                      active
                        ? "bg-[var(--ds-brand-muted)] text-[#a5b4fc]"
                        : "text-[var(--ds-text-secondary)] hover:bg-[var(--ds-bg-subtle)]"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>

          {SECONDARY_NAV.length > 0 ? (
          <>
          <p className="mb-2 mt-4 px-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--ds-text-tertiary)]">
            Account
          </p>
          <ul className="space-y-0.5">
            {SECONDARY_NAV.map((item) => {
              const active = isSecondaryNavActive(item.href, pathname);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-2 rounded-[var(--ds-radius-sm)] px-3 py-2.5 text-sm font-medium transition-colors ${
                      active
                        ? "bg-[var(--ds-brand-muted)] text-[#a5b4fc]"
                        : "text-[var(--ds-text-secondary)] hover:bg-[var(--ds-bg-subtle)]"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
          </>
          ) : null}

          <div className="mt-3 border-t border-[var(--ds-border)] pt-2 space-y-2">
            <Soc2ComplianceBadge className="trust-soc2-badge-mobile w-full justify-center" />
            <button
              type="button"
              onClick={handleMobileLogout}
              disabled={signingOut}
              className="flex w-full items-center gap-2 rounded-[var(--ds-radius-sm)] px-3 py-2.5 text-sm font-medium text-[var(--ds-text-secondary)] hover:bg-[var(--ds-bg-subtle)]"
            >
              <LogOut className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </nav>
      )}
    </header>
  );
}
