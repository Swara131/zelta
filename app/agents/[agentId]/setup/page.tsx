import AgentSetupRoute from "@/components/agents/AgentSetupRoute";

interface AgentSetupRouteProps {
  params: Promise<{ agentId: string }>;
}

export default async function AgentSetupPage({ params }: AgentSetupRouteProps) {
  await params;
  return <AgentSetupRoute />;
}
