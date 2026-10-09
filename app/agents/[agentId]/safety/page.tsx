import { Suspense } from "react";
import AgentSafetyAutopilotPage from "@/components/safety/autopilot/AgentSafetyAutopilotPage";

export default function AgentSafetyRoute() {
  return (
    <Suspense fallback={null}>
      <AgentSafetyAutopilotPage />
    </Suspense>
  );
}
