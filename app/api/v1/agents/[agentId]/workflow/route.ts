import {
  discardAgentWorkflowDraft,
  getAgentWorkflow,
  saveAgentWorkflowDraft,
} from "@/lib/agents/workflow/service";
import { summarizeValidation } from "@/lib/agents/workflow/validate-workflow";
import {
  parseJsonBody,
  secureError,
  secureJson,
} from "@/lib/security/api";
import { ValidationError } from "@/lib/security/errors";
import { saveAgentWorkflowSchema } from "@/lib/security/validation";
import { createClient } from "@/lib/supabase/server";
import type { AgentWorkflowGraph } from "@/lib/agents/workflow/types";

interface RouteContext {
  params: Promise<{ agentId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return secureError("Unauthorized", 401);

  const { agentId: slug } = await context.params;
  const bundle = await getAgentWorkflow(supabase, {
    userId: user.id,
    userEmail: user.email ?? "user@local",
    slug: slug?.trim() ?? "",
  });

  if (!bundle) {
    return secureJson({ success: false, error: "Agent not found." }, { status: 404 });
  }

  return secureJson({
    success: true,
    agentDbId: bundle.agentDbId,
    slug: bundle.slug,
    name: bundle.name,
    graph: bundle.graph,
    state: bundle.state,
    hasDraft: bundle.hasDraft,
  });
}

export async function PUT(request: Request, context: RouteContext) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return secureError("Unauthorized", 401);

  const { agentId: slug } = await context.params;
  const normalizedSlug = slug?.trim();
  if (!normalizedSlug) {
    return secureJson({ success: false, error: "Agent ID is required." }, { status: 400 });
  }

  try {
    const body = await parseJsonBody(request, saveAgentWorkflowSchema);
    const result = await saveAgentWorkflowDraft(supabase, {
      userId: user.id,
      userEmail: user.email ?? "user@local",
      slug: normalizedSlug,
      graph: body.graph as AgentWorkflowGraph,
      displayName: body.displayName,
      suggestedThreshold: body.suggestedThreshold,
      destinationEmail: body.destinationEmail,
    });

    return secureJson({
      success: true,
      agentDbId: result.bundle.agentDbId,
      slug: result.bundle.slug,
      graph: result.bundle.graph,
      state: result.bundle.state,
      hasDraft: result.bundle.hasDraft,
      validation: result.validation,
      validationSummary: summarizeValidation(result.validation),
      safetyDiff: result.safetyDiff,
    });
  } catch (err) {
    if (err instanceof ValidationError) {
      const message = err.details[0] ?? err.message;
      return secureJson({ success: false, error: message }, { status: 400 });
    }

    const message = err instanceof Error ? err.message : "Could not save workflow.";
    return secureJson({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return secureError("Unauthorized", 401);

  const { agentId: slug } = await context.params;
  const normalizedSlug = slug?.trim();
  if (!normalizedSlug) {
    return secureJson({ success: false, error: "Agent ID is required." }, { status: 400 });
  }

  try {
    const state = await discardAgentWorkflowDraft(supabase, {
      userId: user.id,
      userEmail: user.email ?? "user@local",
      slug: normalizedSlug,
    });

    return secureJson({ success: true, state });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not discard draft.";
    return secureJson({ success: false, error: message }, { status: 500 });
  }
}
