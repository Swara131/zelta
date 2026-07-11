import { Suspense } from "react";
import AuthShell from "@/components/auth/AuthShell";
import SignupForm from "@/components/auth/SignupForm";
import { COMPANY_NAME, PRODUCT_NAME } from "@/lib/public-branding";

export const metadata = {
  title: "Sign up",
};

export default function SignupPage() {
  return (
    <AuthShell
      title="Create account"
      description={`Create your ${COMPANY_NAME} account and start using ${PRODUCT_NAME}.`}
    >
      <Suspense fallback={<p className="ds-caption">Loading…</p>}>
        <SignupForm />
      </Suspense>
    </AuthShell>
  );
}
