import { Suspense } from "react";
import AgentPlatformHub from "@/components/agents/platform/AgentPlatformHub";

export default function AgentPlatformRoute() {
  return (
    <Suspense fallback={null}>
      <AgentPlatformHub />
    </Suspense>
  );
}
