import { registerExternalAgentConnection } from "@/lib/agents/external/register-external-agent";
import { testExternalAgentConnection } from "@/lib/agents/external/test-connection";
import { isSupportedConnectionMethod } from "@/lib/agents/external/connection-methods";
import type { AgentConnectionPlatformId } from "@/lib/agents/platform/connection-options";
import { getBuilderAgentBySlug, updateBuilderAgent } from "@/lib/agents/repository";
import { writeExternalConnection } from "@/lib/agents/external/connection-store";
import { mergeTestIntoExistingConnection } from "@/lib/agents/external/register-external-agent";
import { ensureOrganization } from "@/lib/organizations/ensure-organization";
import { parseJsonBody, secureError, secureJson } from "@/lib/security/api";
import { ValidationError } from "@/lib/security/errors";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const registerSchema = z.object({
  agentName: z.string().trim().min(2),
  agentSlug: z.string().trim().optional(),
  platform: z.string(),
  method: z.string(),
  endpointUrl: z.string().trim().optional(),
  authType: z.enum(["none", "bearer", "api_key_header"]).optional(),
  authToken: z.string().optional(),
  authHeaderName: z.string().optional(),
  agentId: z.string().optional(),
  apiKey: z.string().optional(),
  saveOnlyIfPassed: z.boolean().optional(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return secureError("Unauthorized", 401);

  try {
    const organizationId = await ensureOrganization(
      supabase,
      user.id,
      user.email ?? "user@local"
    );
    const body = await parseJsonBody(request, registerSchema);

    if (!isSupportedConnectionMethod(body.method)) {
      return secureError("Unsupported connection method.", 400);
    }

    const testResult = await testExternalAgentConnection({
      method: body.method,
      endpointUrl: body.endpointUrl,
      authType: body.authType,
      authToken: body.authToken,
      authHeaderName: body.authHeaderName,
      agentId: body.agentId,
      apiKey: body.apiKey,
    });

    if (body.saveOnlyIfPassed !== false && !testResult.passed) {
      return secureJson({
        success: false,
        result: testResult,
        error: "Connection test did not pass. Fix the issue and try again.",
      });
    }

    if (body.agentSlug) {
      const existing = await getBuilderAgentBySlug(supabase, organizationId, body.agentSlug);
      if (existing) {
        const merged = mergeTestIntoExistingConnection(existing.safetySettings, testResult);
        if (merged) {
          await updateBuilderAgent(supabase, {
            agentId: existing.id,
            userId: user.id,
            patch: {
              safetySettings: writeExternalConnection(existing.safetySettings, merged),
            },
          });
          return secureJson({ success: testResult.passed, slug: existing.slug, result: testResult });
        }
      }
    }

    const registered = await registerExternalAgentConnection(supabase, {
      userId: user.id,
      organizationId,
      agentName: body.agentName,
      agentSlug: body.agentSlug,
      platform: body.platform as AgentConnectionPlatformId,
      connectionMethod: body.method,
      endpointUrl: body.endpointUrl,
      authType: body.authType,
      authHeaderName: body.authHeaderName,
      authConfigured: Boolean(body.authToken),
      testResult,
    });

    return secureJson({
      success: testResult.passed,
      slug: registered.slug,
      connection: registered.connection,
      result: testResult,
    });
  } catch (err) {
    if (err instanceof ValidationError) {
      return secureError(err.message, 400, { details: err.details });
    }
    const message = err instanceof Error ? err.message : "Registration failed.";
    return secureError(message, 500);
  }
}
