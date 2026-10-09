import { Suspense } from "react";
import AuditLogPage from "@/components/audit/AuditLogPage";

export default function AuditRoute() {
  return (
    <Suspense fallback={null}>
      <AuditLogPage />
    </Suspense>
  );
}
