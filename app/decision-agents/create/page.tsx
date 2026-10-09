import { Suspense } from "react";
import CreateDecisionAgentPage from "@/components/decision-agents/CreateDecisionAgentPage";

export default function CreateDecisionAgentRoute() {
  return (
    <Suspense fallback={null}>
      <CreateDecisionAgentPage />
    </Suspense>
  );
}
