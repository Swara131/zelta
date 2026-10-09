import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import type { BuilderAgentRecord } from "@/lib/agents/runtime-types";
import { getBuilderAgentForUserBySlug } from "@/lib/agents/save-builder-agent-draft";
import {
  enforceRateLimit,
  getClientIp,
  rateLimitKey,
  RATE_LIMIT_STRICT_MAX,
} from "@/lib/security/rate-limit";

export async function requireAgentForSafetyApi(
  supabase: SupabaseClient,
  user: User,
  slug: string
): Promise<BuilderAgentRecord> {
  const agent = await getBuilderAgentForUserBySlug(supabase, {
    userId: user.id,
    userEmail: user.email ?? "user@local",
    slug: slug.trim(),
  });

  if (!agent) {
    throw new AgentNotFoundError();
  }

  return agent;
}

export class AgentNotFoundError extends Error {
  constructor() {
    super("Agent not found.");
    this.name = "AgentNotFoundError";
  }
}

export function enforceSafetyMutationRateLimit(
  request: Request,
  route: string,
  userId: string
): void {
  const ip = getClientIp(request);
  enforceRateLimit(rateLimitKey(`${ip}:${userId}`, route), RATE_LIMIT_STRICT_MAX);
}
