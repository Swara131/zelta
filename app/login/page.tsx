import { Suspense } from "react";
import AuthShell from "@/components/auth/AuthShell";
import LoginForm from "@/components/auth/LoginForm";

export const metadata = {
  title: "Sign in — ApprovalLayer",
};

export default function LoginPage() {
  return (
    <AuthShell
      title="Sign in"
      description="Access your ApprovalLayer dashboard."
    >
      <Suspense fallback={<p className="ds-caption">Loading…</p>}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
