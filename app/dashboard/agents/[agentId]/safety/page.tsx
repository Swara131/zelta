import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ agentId: string }>;
}

/** Preferred spec route alias — redirects to canonical /agents/[agentId]/safety */
export default async function DashboardAgentSafetyRedirect({ params }: PageProps) {
  const { agentId } = await params;
  redirect(`/agents/${encodeURIComponent(agentId)}/safety`);
}
