"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, Settings, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { signOut, AuthError } from "@/lib/auth/actions";

function initialsFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "U";
  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }
  return local.slice(0, 2).toUpperCase();
}

export default function AccountMenu() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
    });
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      router.push("/login");
      router.refresh();
    } catch (err) {
      console.error(err instanceof AuthError ? err.message : "Sign out failed.");
      setSigningOut(false);
    }
  };

  const label = email ?? "Account";
  const initials = email ? initialsFromEmail(email) : "U";

  return (
    <div className="ztop-account" ref={rootRef}>
      <button
        type="button"
        className="ztop-account-trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account menu"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="ztop-avatar" aria-hidden="true">
          {initials}
        </span>
        <ChevronDown
          className={`ztop-account-chevron ${open ? "is-open" : ""}`}
          strokeWidth={2}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div className="ztop-account-menu" role="menu">
          <div className="ztop-account-meta">
            <User className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            <span className="ztop-account-email">{label}</span>
          </div>
          <Link
            href="/settings"
            className="ztop-account-item"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            <Settings className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            Settings
          </Link>
          <button
            type="button"
            className="ztop-account-item"
            role="menuitem"
            disabled={signingOut}
            onClick={() => void handleSignOut()}
          >
            <LogOut className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
