import { Suspense } from "react";
import AuthShell from "@/components/auth/AuthShell";
import LoginForm from "@/components/auth/LoginForm";
import { COMPANY_NAME, DASHBOARD_SUBTITLE } from "@/lib/public-branding";

export const metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return (
    <AuthShell
      title="Sign in"
      description={`Access the ${DASHBOARD_SUBTITLE} on ${COMPANY_NAME}.`}
    >
      <Suspense fallback={<p className="ds-caption">Loading…</p>}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
