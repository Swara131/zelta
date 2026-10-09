import type { SupabaseClient } from "@supabase/supabase-js";
import { recordRuntimeAuditEventAsync } from "@/lib/gateway/audit/runtime-events";
import {
  insertAgentAction,
  insertAgentRun,
  insertAgentRunStep,
  insertToolExecution,
  updateAgentRun,
  updateToolExecution,
} from "../../runtime-repository";
import type { AgentRunMode, AgentRunStatus } from "../../runtime-types";
import type { LoadedAgent, RuntimeLimits, RuntimeStepSummary } from "../types";

function isMissingTableError(message: string | undefined): boolean {
  if (!message) return false;
  return message.includes("schema cache") || message.includes("Could not find");
}

export class RuntimeActivityLogger {
  private readonly steps: RuntimeStepSummary[] = [];
  private stepSequence = 0;
  private persistenceEnabled = true;

  constructor(
    private readonly admin: SupabaseClient,
    private readonly agent: LoadedAgent,
    private readonly userId: string,
    private readonly limits: RuntimeLimits
  ) {}

  getSteps(): RuntimeStepSummary[] {
    return [...this.steps];
  }

  private trackStep(params: {
    key: string;
    label: string;
    detail?: string | null;
    status?: string;
  }): void {
    this.stepSequence += 1;
    this.steps.push({
      key: params.key,
      label: params.label,
      detail: params.detail ?? null,
      status: params.status ?? "completed",
    });
  }

  async createRun(params: {
    task: string;
    mode: AgentRunMode;
    triggerSource?: string;
  }): Promise<string | null> {
    this.trackStep({
      key: "run.start",
      label: "Run started",
      detail: params.task.slice(0, 200),
    });

    try {
      const run = await insertAgentRun(this.admin, {
        agentId: this.agent.record.id,
        userId: this.userId,
        organizationId: this.agent.record.organizationId,
        mode: params.mode,
        status: "running",
        triggerSource: params.triggerSource ?? "runtime",
        limits: {
          maxToolCalls: this.limits.maxToolCalls,
          maxDurationMs: this.limits.maxDurationMs,
          maxTurns: this.limits.maxTurns,
        },
        metadata: { task: params.task },
      });

      recordRuntimeAuditEventAsync(this.admin, {
        organizationId: this.agent.record.organizationId,
        event: "runtime.run.started",
        agentId: this.agent.gatewayAgentId,
        metadata: {
          agentRunId: run.id,
          builderAgentId: this.agent.record.id,
          mode: params.mode,
        },
      });

      return run.id;
    } catch (err) {
      if (
        err instanceof Error &&
        isMissingTableError(err.message)
      ) {
        this.persistenceEnabled = false;
        return null;
      }
      throw err;
    }
  }

  async logRunStep(params: {
    runId: string | null;
    key: string;
    label: string;
    detail?: string | null;
    status?: string;
  }): Promise<void> {
    this.trackStep(params);

    if (!this.persistenceEnabled || !params.runId) return;

    try {
      await insertAgentRunStep(this.admin, {
        agentRunId: params.runId,
        userId: this.userId,
        organizationId: this.agent.record.organizationId,
        sequence: this.stepSequence,
        stepKey: params.key,
        label: params.label,
        detail: params.detail ?? null,
        status: params.status ?? "completed",
      });
    } catch (err) {
      if (err instanceof Error && isMissingTableError(err.message)) return;
      console.warn("[runtime] Failed to persist run step:", err);
    }
  }

  async recordAction(params: {
    runId: string | null;
    sequence: number;
    toolName: string;
    actionType: string;
    summary: string;
    status: string;
    proposalId?: string | null;
    policyDecision?: "allow" | "review" | "block" | null;
  }): Promise<string | null> {
    if (!this.persistenceEnabled || !params.runId) return null;

    try {
      const action = await insertAgentAction(this.admin, {
        agentRunId: params.runId,
        agentId: this.agent.record.id,
        userId: this.userId,
        organizationId: this.agent.record.organizationId,
        sequence: params.sequence,
        toolName: params.toolName,
        actionType: params.actionType,
        summary: params.summary,
        status: params.status as never,
        actionProposalId: params.proposalId ?? null,
        policyDecision: params.policyDecision ?? null,
      });
      return action.id;
    } catch (err) {
      if (err instanceof Error && isMissingTableError(err.message)) return null;
      console.warn("[runtime] Failed to persist agent action:", err);
      return null;
    }
  }

  async recordToolExecution(params: {
    runId: string | null;
    agentActionId: string | null;
    proposalId: string | null;
    toolName: string;
    input: Record<string, unknown>;
    executed: boolean;
    output: Record<string, unknown>;
    error?: string | null;
  }): Promise<void> {
    this.trackStep({
      key: `tool.${params.toolName}`,
      label: params.executed
        ? `${params.toolName} executed`
        : `${params.toolName} not executed`,
      detail: params.error ?? JSON.stringify(params.output).slice(0, 200),
      status: params.executed ? "completed" : "failed",
    });

    if (!this.persistenceEnabled) return;

    try {
      const execution = await insertToolExecution(this.admin, {
        agentId: this.agent.record.id,
        userId: this.userId,
        organizationId: this.agent.record.organizationId,
        toolName: params.toolName,
        agentRunId: params.runId,
        agentActionId: params.agentActionId,
        actionProposalId: params.proposalId,
        status: "running",
        input: params.input,
      });

      await updateToolExecution(this.admin, {
        executionId: execution.id,
        userId: this.userId,
        status: params.executed ? "succeeded" : "failed",
        output: params.output,
        error: params.error ?? null,
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
      });
    } catch (err) {
      if (err instanceof Error && isMissingTableError(err.message)) return;
      console.warn("[runtime] Failed to persist tool execution:", err);
    }
  }

  async finishRun(params: {
    runId: string | null;
    status: AgentRunStatus;
    summary?: string | null;
    errorMessage?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    this.trackStep({
      key:
        params.status === "awaiting_approval"
          ? "run.waiting_approval"
          : params.status === "timeout"
            ? "run.timeout"
            : "run.finish",
      label:
        params.status === "awaiting_approval"
          ? "WAITING FOR APPROVAL"
          : params.status === "timeout"
            ? "Run timed out"
            : "Run finished",
      detail: params.summary ?? params.errorMessage ?? params.status,
      status:
        params.status === "failed" || params.status === "timeout"
          ? "failed"
          : params.status === "awaiting_approval"
            ? "needs_approval"
            : "completed",
    });

    if (!this.persistenceEnabled || !params.runId) return;

    try {
      await updateAgentRun(this.admin, {
        runId: params.runId,
        userId: this.userId,
        status: params.status === "timeout" ? "failed" : params.status,
        summary: params.summary ?? null,
        errorMessage:
          params.errorMessage ??
          (params.status === "timeout" ? "Agent run timed out." : null),
        startedAt: new Date().toISOString(),
        finishedAt:
          params.status === "awaiting_approval" ? null : new Date().toISOString(),
        metadata: {
          ...params.metadata,
          ...(params.status === "timeout"
            ? { timedOut: true, runStatus: "timeout" }
            : {}),
        },
      });
    } catch (err) {
      if (err instanceof Error && isMissingTableError(err.message)) return;
      console.warn("[runtime] Failed to update agent run:", err);
    }

    if (params.status !== "awaiting_approval") {
      recordRuntimeAuditEventAsync(this.admin, {
        organizationId: this.agent.record.organizationId,
        event: "runtime.run.finished",
        agentId: this.agent.gatewayAgentId,
        metadata: {
          agentRunId: params.runId,
          builderAgentId: this.agent.record.id,
          status: params.status,
        },
      });
    }
  }
}
