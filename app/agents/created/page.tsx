import { Suspense } from "react";
import AgentCreatedPage from "@/components/agent-builder/AgentCreatedPage";

export const metadata = {
  title: "Agent created",
};

export default function AgentCreatedRoute() {
  return (
    <Suspense fallback={null}>
      <AgentCreatedPage />
    </Suspense>
  );
}
