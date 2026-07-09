"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import AuthMessage from "./AuthMessage";
import Button from "@/components/ui/Button";

export default function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("code");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(!code);
  const [loading, setLoading] = useState(false);
  const [exchanging, setExchanging] = useState(!!code);

  useEffect(() => {
    if (!code) return;

    const exchange = async () => {
      const supabase = createClient();
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

      if (exchangeError) {
        setError(exchangeError.message);
        setExchanging(false);
        return;
      }

      setReady(true);
      setExchanging(false);
      router.replace("/auth/reset-password");
    };

    exchange();
  }, [code, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    await supabase.auth.signOut();
    router.push("/login?message=password_updated");
    router.refresh();
  };

  if (exchanging) {
    return (
      <p className="text-center text-sm text-[var(--ds-text-secondary)]">
        Verifying reset link…
      </p>
    );
  }

  if (!ready) {
    return (
      <div className="space-y-4">
        {error && <AuthMessage type="error" message={error} />}
        <p className="text-center text-sm text-[var(--ds-text-tertiary)]">
          <Link href="/forgot-password" className="text-[var(--ds-brand)] hover:text-[#a5b4fc]">
            Request a new reset link
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <AuthMessage type="error" message={error} />}

      <div>
        <label htmlFor="password" className="ds-label mb-1.5 block">
          New password
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
          Confirm new password
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
        Update password
      </Button>
    </form>
  );
}
