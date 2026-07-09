import { AgentAuthError } from "@/lib/gateway/errors";
import type { AgentAuthContext } from "@/lib/gateway/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { AGENT_KEY_HEADER } from "./constants";
import {
  authenticateAgentApiKey,
  type AuthenticateAgentApiKeyDeps,
} from "./service";

const BEARER_PREFIX = "Bearer ";

/** Parses `Authorization: Bearer <agent_api_key>` from a request. */
export function extractAgentBearerToken(request: Request): string | null {
  const header =
    request.headers.get(AGENT_KEY_HEADER) ??
    request.headers.get(AGENT_KEY_HEADER.toUpperCase());

  if (!header) {
    return null;
  }

  if (!header.startsWith(BEARER_PREFIX)) {
    return null;
  }

  const token = header.slice(BEARER_PREFIX.length).trim();
  return token || null;
}

/**
 * Authenticates an external agent request via Bearer API key.
 * All secret verification is server-side using the service-role client.
 */
export async function authenticateAgentRequest(
  request: Request,
  deps?: AuthenticateAgentApiKeyDeps
): Promise<AgentAuthContext> {
  const token = extractAgentBearerToken(request);

  if (!token) {
    throw new AgentAuthError("missing_token", "Missing Authorization Bearer token.");
  }

  const admin = createAdminClient();
  return authenticateAgentApiKey(admin, token, deps);
}

/** Non-throwing variant for middleware or optional auth paths. */
export async function tryAuthenticateAgentRequest(
  request: Request,
  deps?: AuthenticateAgentApiKeyDeps
): Promise<AgentAuthContext | null> {
  try {
    return await authenticateAgentRequest(request, deps);
  } catch (err) {
    if (err instanceof AgentAuthError) {
      return null;
    }
    throw err;
  }
}

export function agentAuthErrorStatus(code: AgentAuthError["code"]): number {
  switch (code) {
    case "missing_token":
    case "invalid_token":
      return 401;
    case "revoked_token":
    case "expired_token":
      return 403;
    default:
      return 401;
  }
}
