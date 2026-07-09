"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { signUpWithEmail } from "@/lib/auth/server-actions";
import { formatUnknownAuthError } from "@/lib/auth/errors";
import { DASHBOARD_ROUTE, sanitizeRedirect } from "@/lib/auth/routes";
import AuthMessage from "./AuthMessage";
import AuthDivider from "./AuthDivider";
import GoogleSignInButton from "./GoogleSignInButton";
import Button from "@/components/ui/Button";

export default function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = sanitizeRedirect(searchParams.get("redirectTo"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const { session } = await signUpWithEmail(email, password, redirectTo);

      if (session) {
        router.push(redirectTo);
        router.refresh();
        return;
      }

      setSuccess("Check your email to confirm your account, then sign in.");
    } catch (err) {
      const message = formatUnknownAuthError(err, "Sign up failed. Please try again.");
      setError(
        message.includes("Database error saving new user")
          ? "Database error saving new user. In Supabase → SQL Editor, run: DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;"
          : message
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <GoogleSignInButton redirectTo={redirectTo} label="Sign up with Google" />

      <AuthDivider label="or sign up with email" />

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <>
            <AuthMessage type="error" message={error} />
            {error.includes("Database error") && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-[var(--ds-text-secondary)]">
                <p className="font-medium text-amber-200">One-time Supabase fix</p>
                <p className="mt-1">
                  Open{" "}
                  <a
                    href="https://supabase.com/dashboard/project/uwjthfovheiftvjwyanz/sql/new"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--ds-brand)] underline"
                  >
                    Supabase SQL Editor
                  </a>
                  , paste this, and click Run:
                </p>
                <pre className="mt-2 overflow-x-auto rounded bg-black/40 p-2 font-mono text-[11px] text-amber-100">
                  DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
                </pre>
              </div>
            )}
          </>
        )}
        {success && <AuthMessage type="success" message={success} />}

        <div>
          <label htmlFor="email" className="ds-label mb-1.5 block">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="ds-input"
            placeholder="you@company.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="ds-label mb-1.5 block">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="ds-input"
            placeholder="At least 6 characters"
          />
        </div>

        <div>
          <label htmlFor="confirmPassword" className="ds-label mb-1.5 block">
            Confirm password
          </label>
          <input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="ds-input"
            placeholder="Repeat password"
          />
        </div>

        <Button type="submit" variant="primary" className="w-full" loading={loading}>
          Create account
        </Button>

        <p className="text-center text-sm text-[var(--ds-text-tertiary)]">
          Already have an account?{" "}
          <Link
            href={`/login${redirectTo !== DASHBOARD_ROUTE ? `?redirectTo=${encodeURIComponent(redirectTo)}` : ""}`}
            className="font-medium text-[var(--ds-brand)] hover:text-[#a5b4fc]"
          >
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
