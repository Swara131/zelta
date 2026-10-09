import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import PageShell from "@/components/ui/PageShell";
import VisualAgentBuilder from "@/components/agents/workflow-builder/VisualAgentBuilder";

function BuilderFallback() {
  return (
    <p className="wfb-loading">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
      Loading agent builder…
    </p>
  );
}

export default function AgentEditPage() {
  return (
    <PageShell maxWidth="7xl" className="wfb-page">
      <Suspense fallback={<BuilderFallback />}>
        <VisualAgentBuilder />
      </Suspense>
    </PageShell>
  );
}
