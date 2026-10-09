import { getAgentWorkflow } from "@/lib/agents/workflow/service";
import { secureError, secureJson } from "@/lib/security/api";
import { createClient } from "@/lib/supabase/server";

interface RouteContext {
  params: Promise<{ agentId: string }>;
}

/** Node tests use the existing Test Agent workspace. This endpoint never fakes success. */
export async function POST(request: Request, context: RouteContext) {
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

  let nodeId = "";
  try {
    const body = (await request.json()) as { nodeId?: string };
    nodeId = body.nodeId?.trim() ?? "";
  } catch {
    nodeId = "";
  }

  const node = bundle.graph.nodes.find((item) => item.id === nodeId);
  if (!node) {
    return secureJson({ success: false, error: "Node not found." }, { status: 404 });
  }

  if (node.type === "placeholder_tool" || node.config.placeholderIntegration) {
    return secureJson({
      success: false,
      executed: false,
      error: "This connector is a sample placeholder and cannot run.",
    });
  }

  return secureJson({
    success: false,
    executed: false,
    error: "Node-level execution is not connected here. Use Test Agent for a real run.",
    testHref: `/agents/${encodeURIComponent(bundle.slug)}/test`,
  });
}
