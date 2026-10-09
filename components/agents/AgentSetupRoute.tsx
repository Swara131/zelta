"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import PageShell from "@/components/ui/PageShell";
import AgentDetailPage from "@/components/agents/AgentDetailPage";
import AgentSetupWizard from "@/components/agents/AgentSetupWizard";

function AgentSetupRouteContent() {
  const searchParams = useSearchParams();
  const wizardMode = searchParams.get("wizard");

  if (wizardMode) {
    return <AgentSetupWizard />;
  }

  return <AgentDetailPage />;
}

export default function AgentSetupRoute() {
  return (
    <Suspense
      fallback={
        <PageShell maxWidth="4xl">
          <div className="ag-loading">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            Loading agent…
          </div>
        </PageShell>
      }
    >
      <AgentSetupRouteContent />
    </Suspense>
  );
}
