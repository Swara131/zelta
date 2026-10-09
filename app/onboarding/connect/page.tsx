import { Suspense } from "react";
import ConnectProtectPage from "@/components/onboarding/ConnectProtectPage";

export default function ConnectProtectRoute() {
  return (
    <Suspense
      fallback={
        <div className="ds-page mx-auto flex min-h-[40vh] max-w-4xl items-center justify-center">
          <p className="text-sm text-[var(--ds-text-tertiary)]">Loading…</p>
        </div>
      }
    >
      <ConnectProtectPage />
    </Suspense>
  );
}
