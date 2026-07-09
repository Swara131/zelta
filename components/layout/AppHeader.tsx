"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import LogoutButton from "@/components/auth/LogoutButton";
import {
  Shield,
  Upload,
  Languages,
  ShieldAlert,
  GitBranch,
  ClipboardCheck,
  BarChart3,
  Bell,
  Plug,
  CreditCard,
  Menu,
  X,
  LogOut,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const NAV_ITEMS = [
  { href: "/upload", label: "Upload", icon: Upload },
  { href: "/translator", label: "Translator", icon: Languages },
  { href: "/risk", label: "Risk", icon: ShieldAlert },
  { href: "/approvals", label: "Approvals", icon: ClipboardCheck },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/notifications", label: "Alerts", icon: Bell },
  { href: "/integrations", label: "Integrate", icon: Plug },
  { href: "/billing", label: "Billing", icon: CreditCard },
  { href: "/pipeline", label: "Pipeline", icon: GitBranch },
];

export default function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const handleMobileLogout = async () => {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    setMobileOpen(false);
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--ds-border)] bg-[var(--ds-bg-elevated)]/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-brand)]"
          aria-label="ApprovalLayer home"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-[var(--ds-radius-sm)] bg-[var(--ds-brand)] shadow-[var(--ds-shadow-brand)]">
            <Shield className="h-5 w-5 text-white" strokeWidth={2} aria-hidden="true" />
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-semibold tracking-tight text-[var(--ds-text-primary)]">
              ApprovalLayer
            </p>
            <p className="text-[11px] text-[var(--ds-text-tertiary)]">Enterprise security</p>
          </div>
        </Link>

        <nav
          className="hidden min-w-0 flex-1 items-center justify-center lg:flex"
          aria-label="Main navigation"
        >
          <div className="ds-tabs max-w-full">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`ds-tab inline-flex items-center gap-1.5 ${active ? "ds-tab-active" : ""}`}
                >
                  <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                  {label}
                </Link>
              );
            })}
          </div>
        </nav>

        <nav
          className="hidden min-w-0 flex-1 overflow-x-auto md:flex lg:hidden"
          aria-label="Main navigation"
        >
          <div className="ds-tabs mx-auto">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  title={label}
                  aria-current={active ? "page" : undefined}
                  aria-label={label}
                  className={`ds-tab inline-flex items-center ${active ? "ds-tab-active" : ""}`}
                >
                  <Icon className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                </Link>
              );
            })}
          </div>
        </nav>

        <LogoutButton />

        <button
          type="button"
          className="ds-btn ds-btn-ghost ds-btn-icon ml-auto md:ml-0 md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen && (
        <nav
          id="mobile-nav"
          className="border-t border-[var(--ds-border)] bg-[var(--ds-bg-elevated)] px-4 py-3 md:hidden"
          aria-label="Mobile navigation"
        >
          <ul className="grid grid-cols-2 gap-1">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-2 rounded-[var(--ds-radius-sm)] px-3 py-2.5 text-sm font-medium transition-colors ${
                      active
                        ? "bg-[var(--ds-brand-muted)] text-[#a5b4fc]"
                        : "text-[var(--ds-text-secondary)] hover:bg-[var(--ds-bg-subtle)]"
                    }`}
                  >
                    <Icon className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                    {label}
                  </Link>
                </li>
              );
            })}
            <li className="col-span-2 mt-1 border-t border-[var(--ds-border)] pt-2">
              <button
                type="button"
                onClick={handleMobileLogout}
                disabled={signingOut}
                className="flex w-full items-center gap-2 rounded-[var(--ds-radius-sm)] px-3 py-2.5 text-sm font-medium text-[var(--ds-text-secondary)] hover:bg-[var(--ds-bg-subtle)]"
              >
                <LogOut className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                {signingOut ? "Signing out…" : "Sign out"}
              </button>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
