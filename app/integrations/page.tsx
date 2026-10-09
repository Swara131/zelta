import { Suspense } from "react";
import IntegrationsPage from "@/components/integrations/IntegrationsPage";

export default function IntegrationsRoute() {
  return (
    <Suspense fallback={null}>
      <IntegrationsPage />
    </Suspense>
  );
}
