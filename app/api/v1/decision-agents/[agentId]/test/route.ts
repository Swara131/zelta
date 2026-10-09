import { evaluateDecision } from "@/lib/decision-agents/evaluate-decision";
import { getDecisionAgentBySlug } from "@/lib/decision-agents/repository";
import { getAgentRequirements, snapshotFromDecisionAgent } from "@/lib/agents/requirements";
import { ensureOrganization } from "@/lib/organizations/ensure-organization";
import { parseJsonBody, secureError, secureJson } from "@/lib/security/api";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const testSchema = z.object({
  input: z.record(z.string(), z.unknown()),
  expectedDecision: z.string().trim().optional(),
  testCaseId: z.string().uuid().optional(),
});

interface RouteContext {
  params: Promise<{ agentId: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return secureError("Unauthorized", 401);

  const { agentId: slug } = await context.params;
  const organizationId = await ensureOrganization(
    supabase,
    user.id,
    user.email ?? "user@local"
  );

  const agent = await getDecisionAgentBySlug(supabase, {
    organizationId,
    slug: slug?.trim() ?? "",
    userId: user.id,
  });
  if (!agent) return secureJson({ success: false, error: "Not found." }, { status: 404 });

  const requirements = getAgentRequirements(snapshotFromDecisionAgent(agent, { stage: "test" }));
  if (!requirements.ready) {
    return secureJson(
      {
        success: false,
        error: "Your agent isn't ready to test yet.",
        missing: requirements.missing,
      },
      { status: 400 }
    );
  }

  const body = await parseJsonBody(request, testSchema);
  const result = evaluateDecision(agent.config, body.input);
  const expected = body.expectedDecision?.toUpperCase();
  const actual = result.outcome.toUpperCase();
  const status =
    expected && expected !== actual
      ? "fail"
      : expected
        ? "pass"
        : "needs_attention";

  await supabase.from("decision_audit_log").insert({
    decision_agent_id: agent.id,
    user_id: user.id,
    input_summary: JSON.stringify(body.input),
    decision: actual,
    reasoning_summary: result.reasoning,
    policy_evaluated: result.matchedRuleId ?? "default",
    risk_result: String(body.input.risk_score ?? "n/a"),
    action_taken: actual,
    human_approval_required: actual === "REVIEW",
    final_result: actual,
  });

  if (body.testCaseId) {
    await supabase
      .from("decision_agent_test_cases")
      .update({
        actual_decision: actual,
        status,
        last_run_at: new Date().toISOString(),
      })
      .eq("id", body.testCaseId)
      .eq("decision_agent_id", agent.id);
  }

  return secureJson({
    success: true,
    expected: expected ?? null,
    actual,
    status,
    decision: actual,
    reason: result.reasoning,
    risk: result.riskLevel,
    result,
  });
}
