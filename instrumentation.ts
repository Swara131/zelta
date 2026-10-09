export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { startAgentScheduler } = await import("@/lib/agents/scheduling/agent-scheduler");
  startAgentScheduler();
}
