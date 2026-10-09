import { randomUUID } from "crypto";
import { getBuilderAgentForUserBySlug } from "@/lib/agents/save-builder-agent-draft";
import { readPlatformLifecycle, writePlatformLifecycle } from "@/lib/agents/platform/lifecycle-store";
import type { AgentTestCaseRecord } from "@/lib/agents/platform/lifecycle-types";
import { updateBuilderAgent } from "@/lib/agents/repository";
import { parseJsonBody, secureError, secureJson } from "@/lib/security/api";
import { ValidationError } from "@/lib/security/errors";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const testCaseSchema = z.object({
  input: z.string().trim().min(3).max(2000),
  expectedBehavior: z.string().trim().min(3).max(2000),
  aiGeneratedExpectation: z.boolean().optional(),
});

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
  const agent = await getBuilderAgentForUserBySlug(supabase, {
    userId: user.id,
    userEmail: user.email ?? "user@local",
    slug: slug?.trim() ?? "",
  });
  if (!agent) return secureJson({ success: false, error: "Agent not found." }, { status: 404 });

  const lifecycle = readPlatformLifecycle(agent.safetySettings);
  return secureJson({ success: true, testCases: lifecycle.testCases });
}

export async function POST(request: Request, context: RouteContext) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return secureError("Unauthorized", 401);

  const { agentId: slug } = await context.params;
  const agent = await getBuilderAgentForUserBySlug(supabase, {
    userId: user.id,
    userEmail: user.email ?? "user@local",
    slug: slug?.trim() ?? "",
  });
  if (!agent) return secureJson({ success: false, error: "Agent not found." }, { status: 404 });

  try {
    const body = await parseJsonBody(request, testCaseSchema);
    const lifecycle = readPlatformLifecycle(agent.safetySettings);
    const testCase: AgentTestCaseRecord = {
      id: randomUUID(),
      input: body.input,
      expectedBehavior: body.expectedBehavior,
      status: "not_run",
      aiGeneratedExpectation: body.aiGeneratedExpectation ?? false,
    };
    lifecycle.testCases = [...lifecycle.testCases, testCase];

    await updateBuilderAgent(supabase, {
      agentId: agent.id,
      userId: user.id,
      patch: {
        safetySettings: writePlatformLifecycle(agent.safetySettings, lifecycle),
      },
    });

    return secureJson({ success: true, testCase, testCases: lifecycle.testCases }, { status: 201 });
  } catch (err) {
    if (err instanceof ValidationError) {
      return secureJson({ success: false, error: err.message }, { status: 400 });
    }
    return secureJson({ success: false, error: "Could not add test case." }, { status: 500 });
  }
}
