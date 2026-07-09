"use client";

import Link from "next/link";
import { useState } from "react";
import { sendPasswordResetEmail, AuthError } from "@/lib/auth/actions";
import AuthMessage from "./AuthMessage";
import Button from "@/components/ui/Button";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      await sendPasswordResetEmail(email);
      setSuccess(
        "If an account exists for that email, you will receive a password reset link shortly."
      );
    } catch (err) {
      setError(err instanceof AuthError ? err.message : "Could not send reset email.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <AuthMessage type="error" message={error} />}
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

      <Button type="submit" variant="primary" className="w-full" loading={loading}>
        Send reset link
      </Button>

      <p className="text-center text-sm text-[var(--ds-text-tertiary)]">
        Remember your password?{" "}
        <Link href="/login" className="font-medium text-[var(--ds-brand)] hover:text-[#a5b4fc]">
          Sign in
        </Link>
      </p>
    </form>
  );
}
