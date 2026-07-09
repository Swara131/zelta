"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { signInWithEmail } from "@/lib/auth/server-actions";
import { AuthError } from "@/lib/auth/errors";
import { DASHBOARD_ROUTE, sanitizeRedirect } from "@/lib/auth/routes";
import AuthMessage from "./AuthMessage";
import AuthDivider from "./AuthDivider";
import GoogleSignInButton from "./GoogleSignInButton";
import Button from "@/components/ui/Button";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = sanitizeRedirect(searchParams.get("redirectTo"));
  const authError = searchParams.get("error");
  const authMessage = searchParams.get("message");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    authError === "auth_callback_failed"
      ? "Sign-in link expired or is invalid. Please try again."
      : authError === "reset_link_invalid"
        ? "Password reset link is invalid or expired."
        : null
  );
  const [info, setInfo] = useState<string | null>(
    authMessage === "password_updated"
      ? "Password updated. Sign in with your new password."
      : null
  );
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await signInWithEmail(email, password);
      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Sign in failed. Check Supabase credentials in .env.local."
      );
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <GoogleSignInButton redirectTo={redirectTo} label="Sign in with Google" />

      <AuthDivider />

      <form onSubmit={handleSubmit} className="space-y-4">
        {info && <AuthMessage type="success" message={info} />}
        {error && <AuthMessage type="error" message={error} />}

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
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="password" className="ds-label">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-[var(--ds-brand)] hover:text-[#a5b4fc]"
            >
              Forgot password?
            </Link>
          </div>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="ds-input"
            placeholder="••••••••"
          />
        </div>

        <Button type="submit" variant="primary" className="w-full" loading={loading}>
          Sign in with email
        </Button>

        <p className="text-center text-sm text-[var(--ds-text-tertiary)]">
          Don&apos;t have an account?{" "}
          <Link
            href={`/signup${redirectTo !== DASHBOARD_ROUTE ? `?redirectTo=${encodeURIComponent(redirectTo)}` : ""}`}
            className="font-medium text-[var(--ds-brand)] hover:text-[#a5b4fc]"
          >
            Sign up
          </Link>
        </p>
      </form>
    </div>
  );
}
