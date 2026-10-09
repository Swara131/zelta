"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import PageShell from "@/components/ui/PageShell";

/** Workspace removed — redirect to setup (Create → Setup → Use). */
export default function AgentWorkspaceRoute() {
  const params = useParams();
  const router = useRouter();
  const agentId = typeof params.agentId === "string" ? params.agentId.trim() : "";

  useEffect(() => {
    if (!agentId) return;
    router.replace(`/agents/${encodeURIComponent(agentId)}/setup`);
  }, [agentId, router]);

  return (
    <PageShell maxWidth="4xl">
      <div className="ag-loading">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        Opening agent setup…
      </div>
    </PageShell>
  );
}
