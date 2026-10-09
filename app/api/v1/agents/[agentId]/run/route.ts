import { runAgentEngine } from "@/lib/agents/runtime/run-agent";
import { getBuilderAgentForUserBySlug } from "@/lib/agents/save-builder-agent-draft";
import { AgentNotRunnableError, AgentRuntimeError } from "@/lib/agents/runtime/errors";
import { RequirementsNotReadyError } from "@/lib/agents/requirements/errors";
import {
  applyChatAnswerIfPending,
  gateOrAskForRequirements,
} from "@/lib/agents/runtime/chat-readiness";
import {
  parseJsonBody,
  secureError,
  secureJson,
} from "@/lib/security/api";
import { ValidationError } from "@/lib/security/errors";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const runAgentSchema = z.object({
  task: z
    .string()
    .trim()
    .min(3, "Describe what you want the agent to do.")
    .max(4000, "Task is too long."),
  mode: z.enum(["manual", "test", "scheduled", "live"]).optional(),
});

interface RouteContext {
  params: Promise<{ agentId: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return secureError("Unauthorized", 401);
  }

  const { agentId: slug } = await context.params;
  const normalizedSlug = slug?.trim();
  if (!normalizedSlug) {
    return secureError("Agent ID is required.", 400);
  }

  try {
    const body = await parseJsonBody(request, runAgentSchema);

    const agent = await getBuilderAgentForUserBySlug(supabase, {
      userId: user.id,
      userEmail: user.email ?? "user@local",
      slug: normalizedSlug,
    });

    if (!agent) {
      return secureJson({ success: false, error: "Agent not found." }, { status: 404 });
    }

    const mode = body.mode ?? "manual";
    const runnable = await applyChatAnswerIfPending(
      supabase,
      agent,
      user.id,
      body.task
    );
    const gated = await gateOrAskForRequirements({
      supabase,
      agent: runnable,
      userId: user.id,
      mode,
    });

    if (gated.question) {
      return secureJson({
        success: false,
        needsInput: true,
        result: {
          runId: null,
          status: "failed",
          summary: `I need one more detail before I can run: ${gated.question.label}. ${gated.question.reason}`,
          error: null,
          proposalId: null,
          toolCalls: 0,
          turns: 0,
          steps: [],
        },
      });
    }

    const result = await runAgentEngine(supabase, {
      agentDbId: gated.agent.id,
      userId: user.id,
      userEmail: user.email ?? "user@local",
      task: body.task,
      mode,
      triggerSource: "api",
    });

    const deliveryFailed = result.delivery?.status === "failed";
    return secureJson({
      success:
        !deliveryFailed &&
        (result.status === "completed" || result.status === "awaiting_approval"),
      result,
    });
  } catch (err) {
    if (err instanceof RequirementsNotReadyError) {
      return secureJson(
        {
          success: false,
          error: err.message,
          missing: err.missing,
          preparePath: `/agents/${encodeURIComponent(normalizedSlug)}/prepare`,
        },
        { status: 409 }
      );
    }
    if (err instanceof ValidationError) {
      const message = err.details[0] ?? err.message;
      return secureJson({ success: false, error: message }, { status: 400 });
    }

    if (err instanceof AgentNotRunnableError) {
      return secureJson({ success: false, error: err.message }, { status: 400 });
    }

    if (err instanceof AgentRuntimeError) {
      return secureJson({ success: false, error: err.message }, { status: 400 });
    }

    console.error("Agent runtime run failed:", err);
    return secureJson(
      { success: false, error: "Something went wrong running your agent." },
      { status: 500 }
    );
  }
}
