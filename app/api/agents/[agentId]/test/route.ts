import { NextResponse } from "next/server";
import { z } from "zod";
import {
  AGENT_TEST_TOOLS,
  evaluateAgentTestAction,
  type AgentTestToolId,
} from "@/lib/agents/evaluate-agent-test";
import { submitAgentTestProposal } from "@/lib/agents/submit-agent-test-proposal";
import { ensureOrganization } from "@/lib/organizations/ensure-organization";
import { parseJsonBody, secureError, secureJson } from "@/lib/security/api";
import { ValidationError } from "@/lib/security/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { humanizeAgentLabel } from "@/lib/dashboard/founder-copy";

const TOOL_IDS = AGENT_TEST_TOOLS.map((tool) => tool.id) as [
  AgentTestToolId,
  ...AgentTestToolId[],
];

const agentTestSchema = z.object({
  toolName: z.enum(TOOL_IDS),
  payload: z.record(z.string(), z.unknown()).default({}),
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

  const { agentId } = await context.params;
  const normalizedAgentId = agentId?.trim();
  if (!normalizedAgentId) {
    return secureError("Agent ID is required.", 400);
  }

  try {
    const body = await parseJsonBody(request, agentTestSchema);
    const result = evaluateAgentTestAction({
      agentId: normalizedAgentId,
      toolId: body.toolName,
      payload: body.payload,
    });

    let proposalId: string | null = null;
    let notificationSent = false;

    if (result.decision === "REVIEW") {
      const organizationId = await ensureOrganization(
        supabase,
        user.id,
        user.email ?? "user@local"
      );
      const admin = createAdminClient();
      const submission = await submitAgentTestProposal(admin, {
        organizationId,
        userId: user.id,
        agentId: normalizedAgentId,
        evaluation: result,
      });
      proposalId = submission.proposalId;
      notificationSent = submission.notificationSent;
    }

    return secureJson({
      success: true,
      agentName: humanizeAgentLabel(normalizedAgentId, null),
      result,
      proposalId,
      notificationSent,
      approvalsUrl: proposalId ? `/approvals?proposal=${proposalId}` : null,
    });
  } catch (err) {
    if (err instanceof ValidationError) {
      return secureError(err.message, 400, { details: err.details });
    }

    const message = err instanceof Error ? err.message : "Test evaluation failed.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
