import { Suspense } from "react";
import AuthShell from "@/components/auth/AuthShell";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";

export const metadata = {
  title: "Set new password",
};

export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="Set new password"
      description="Choose a new password for your account."
    >
      <Suspense fallback={<p className="ds-caption">Loading…</p>}>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
