import type { AgentRunStatus } from "../runtime-types";
import type { RunAgentStatus } from "./types";

const LABELS: Record<string, string> = {
  pending: "QUEUED",
  queued: "QUEUED",
  running: "RUNNING",
  awaiting_approval: "WAITING_FOR_APPROVAL",
  approved: "APPROVED",
  denied: "DENIED",
  cancelled: "DENIED",
  completed: "COMPLETED",
  failed: "FAILED",
  expired: "EXPIRED",
  timeout: "EXPIRED",
};

export function formatRunStatusLabel(status: AgentRunStatus | RunAgentStatus | string): string {
  return LABELS[status] ?? status.replace(/_/g, " ").toUpperCase();
}
