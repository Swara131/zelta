"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import PageShell from "@/components/ui/PageShell";

/** Legacy route — redirects to the agent setup wizard. */
export default function AgentCreatedPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const agentId = searchParams.get("agent")?.trim() ?? "";

  useEffect(() => {
    if (agentId) {
      router.replace(`/agents/${encodeURIComponent(agentId)}/setup`);
      return;
    }
    router.replace("/agents/build");
  }, [agentId, router]);

  return (
    <PageShell maxWidth="4xl">
      <div className="ac-loading">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        Opening agent setup…
      </div>
    </PageShell>
  );
}
