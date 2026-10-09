import type { SupabaseClient } from "@supabase/supabase-js";
import type { CrmUpdateResult, WhatsAppNotifyResult } from "@/lib/agents/crm/types";
import { runAgentEngine } from "@/lib/agents/runtime/run-agent";
import type { BuilderAgentRecord } from "@/lib/agents/runtime-types";
import {
  deriveExecutableTaskFromSetup,
  setupAnswersFromAgent,
} from "@/lib/agents/runtime/execution-plan";
import { assertBuilderAgentRequirementsReady } from "@/lib/agents/requirements/assert-ready";
import type { AgentPlatformLifecycle, PlatformCheckResult } from "./lifecycle-types";
import { verifyAgentPlatform } from "./verify-agent";

export interface TestSuiteResult {
  lifecycle: AgentPlatformLifecycle;
  runId?: string | null;
  runStatus?: string;
  runSummary?: string | null;
  runError?: string | null;
  crmResult?: CrmUpdateResult;
  whatsappResult?: WhatsAppNotifyResult | null;
}

export async function runAgentTestSuite(
  supabase: SupabaseClient,
  params: {
    agent: BuilderAgentRecord;
    userId: string;
    userEmail: string;
    task?: string;
    existingLifecycle?: AgentPlatformLifecycle;
  }
): Promise<TestSuiteResult> {
  assertBuilderAgentRequirementsReady(params.agent, "test");

  let executionCheck: PlatformCheckResult;
  let outputCheck: PlatformCheckResult;
  let runId: string | null = null;
  let runStatus: string | undefined;
  let runSummary: string | null = null;
  let runError: string | null = null;

  const task =
    params.task?.trim() ||
    deriveExecutableTaskFromSetup({
      goal: params.agent.goal,
      description: params.agent.description,
      setupAnswers: setupAnswersFromAgent(params.agent),
    });

  try {
    const result = await runAgentEngine(supabase, {
      agentDbId: params.agent.id,
      userId: params.userId,
      userEmail: params.userEmail,
      task,
      mode: "test",
    });

    runId = result.runId ?? null;
    runStatus = result.status;
    runSummary = result.summary ?? null;
    runError = result.error ?? null;

    const executionOk =
      result.status === "completed" || result.status === "awaiting_approval";
    executionCheck = {
      id: "execution",
      label: "Execution",
      status: executionOk ? "pass" : "fail",
      message: executionOk
        ? result.status === "awaiting_approval"
          ? "Agent ran and routed an action for approval."
          : "Agent executed successfully."
        : result.error ??
          result.delivery?.error ??
          result.delivery?.email?.error ??
          result.delivery?.whatsapp?.error ??
          "Agent execution failed.",
      checkedAt: new Date().toISOString(),
    };

    const delivery = result.delivery;
    if (delivery?.whatsapp?.status === "failed") {
      outputCheck = {
        id: "output",
        label: "WhatsApp Notification",
        status: "fail",
        message: delivery.whatsapp.error ?? "WhatsApp delivery failed.",
        fixHref: "/settings?tab=integrations&provider=whatsapp",
        fixLabel: "Configure WhatsApp",
        checkedAt: new Date().toISOString(),
      };
    } else if (delivery?.email?.status === "failed" || delivery?.status === "failed") {
      outputCheck = {
        id: "output",
        label: "Email delivery",
        status: "fail",
        message: delivery.email?.error ?? delivery.error ?? "Delivery did not succeed.",
        fixHref: "/settings?tab=integrations&provider=email",
        fixLabel: "Configure email",
        checkedAt: new Date().toISOString(),
      };
    } else if (delivery?.whatsapp?.status === "sent") {
      outputCheck = {
        id: "output",
        label: "WhatsApp Notification",
        status: "pass",
        message: `Sent to ${delivery.whatsapp.destination ?? "recipient"}.`,
        checkedAt: new Date().toISOString(),
      };
    } else if (delivery?.email?.status === "sent") {
      outputCheck = {
        id: "output",
        label: "Email delivery",
        status: "pass",
        message: `Sent to ${delivery.email.destination ?? "recipient"}.`,
        checkedAt: new Date().toISOString(),
      };
    } else if (result.summary?.trim()) {
      outputCheck = {
        id: "output",
        label: "Output",
        status: "pass",
        message: "Agent produced output.",
        checkedAt: new Date().toISOString(),
      };
    } else if (result.status === "completed") {
      outputCheck = {
        id: "output",
        label: "Output",
        status: "needs_attention",
        message: "Execution completed but no summary output was recorded.",
        checkedAt: new Date().toISOString(),
      };
    } else {
      outputCheck = {
        id: "output",
        label: "Output",
        status: "fail",
        message: "No output produced.",
        checkedAt: new Date().toISOString(),
      };
    }
  } catch (err) {
    runError = err instanceof Error ? err.message : "Test run failed.";
    executionCheck = {
      id: "execution",
      label: "Execution",
      status: "fail",
      message: runError,
      fixHref: `/agents/${encodeURIComponent(params.agent.slug)}/edit`,
      fixLabel: "Fix agent",
      checkedAt: new Date().toISOString(),
    };
    outputCheck = {
      id: "output",
      label: "Output",
      status: "not_run",
      message: "Skipped because execution failed.",
      checkedAt: new Date().toISOString(),
    };
  }

  const lifecycle = await verifyAgentPlatform(supabase, params.agent, {
    executionCheck,
    outputCheck,
  });

  lifecycle.stage = "testing";
  lifecycle.lastTestedAt = new Date().toISOString();

  if (params.existingLifecycle?.testCases.length) {
    lifecycle.testCases = params.existingLifecycle.testCases.map((testCase) => {
      if (testCase.status !== "not_run") return testCase;
      return {
        ...testCase,
        status:
          executionCheck.status === "pass" && outputCheck.status === "pass"
            ? ("pass" as const)
            : ("fail" as const),
        actualResult: runSummary ?? runError ?? testCase.actualResult,
        lastRunAt: new Date().toISOString(),
      };
    });
  }

  return {
    lifecycle,
    runId,
    runStatus,
    runSummary,
    runError,
  };
}
