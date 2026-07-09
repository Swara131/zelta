import { Suspense } from "react";
import AuthShell from "@/components/auth/AuthShell";
import SignupForm from "@/components/auth/SignupForm";

export const metadata = {
  title: "Sign up — ApprovalLayer",
};

export default function SignupPage() {
  return (
    <AuthShell
      title="Create account"
      description="Start securing your agent action workflows."
    >
      <Suspense fallback={<p className="ds-caption">Loading…</p>}>
        <SignupForm />
      </Suspense>
    </AuthShell>
  );
}
