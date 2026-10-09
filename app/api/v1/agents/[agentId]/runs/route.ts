import {
  getBuilderAgentForUserBySlug,
} from "@/lib/agents/save-builder-agent-draft";
import {
  isMissingRuntimeTableError,
  listAgentRunStepsForRun,
  listAgentRunsForAgent,
} from "@/lib/agents/runtime-repository";
import { secureError, secureJson } from "@/lib/security/api";
import { createClient } from "@/lib/supabase/server";

interface RouteContext {
  params: Promise<{ agentId: string }>;
}

export async function GET(request: Request, context: RouteContext) {
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
    const agent = await getBuilderAgentForUserBySlug(supabase, {
      userId: user.id,
      userEmail: user.email ?? "user@local",
      slug: normalizedSlug,
    });

    if (!agent) {
      return secureJson({ error: "Agent not found." }, { status: 404 });
    }

    const url = new URL(request.url);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? "20"), 50);
    const runs = await listAgentRunsForAgent(supabase, {
      agentId: agent.id,
      userId: user.id,
      limit,
    });

    const runsWithSteps = await Promise.all(
      runs.map(async (run) => {
        let steps: Awaited<ReturnType<typeof listAgentRunStepsForRun>> = [];
        try {
          steps = await listAgentRunStepsForRun(supabase, {
            runId: run.id,
            userId: user.id,
          });
        } catch {
          steps = [];
        }

        const metadata = run.metadata as Record<string, unknown> | undefined;
        const delivery =
          metadata?.delivery && typeof metadata.delivery === "object"
            ? metadata.delivery
            : null;

        return {
          id: run.id,
          status: run.status,
          mode: run.mode,
          summary: run.summary,
          errorMessage: run.errorMessage,
          delivery,
          startedAt: run.startedAt,
          finishedAt: run.finishedAt,
          createdAt: run.createdAt,
          steps: steps.map((step) => ({
            id: step.id,
            key: step.stepKey,
            label: step.label,
            detail: step.detail,
            status: step.status,
            sequence: step.sequence,
          })),
        };
      })
    );

    return secureJson({ runs: runsWithSteps, persistenceEnabled: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load agent runs.";
    if (isMissingRuntimeTableError(message)) {
      return secureJson({
        runs: [],
        persistenceEnabled: false,
        warning:
          "Run history is unavailable until the agent runtime migration is applied in Supabase.",
      });
    }
    return secureJson({ error: message }, { status: 500 });
  }
}
