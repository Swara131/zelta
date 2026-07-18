import { Suspense } from "react";
import PendingApprovalsPage from "@/components/approvals/PendingApprovalsPage";

export default function ApprovalsRoute() {
  return (
    <Suspense
      fallback={
        <p className="p-8 text-sm text-[var(--ds-text-secondary)]">Loading approvals…</p>
      }
    >
      <PendingApprovalsPage />
    </Suspense>
  );
}
