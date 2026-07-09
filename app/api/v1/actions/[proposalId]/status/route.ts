import { NextResponse } from "next/server";
import { AgentAuthError, ExecutionTokenError, ProposalError } from "@/lib/gateway/errors";
import {
  agentAuthErrorStatus,
  authenticateAgentRequest,
} from "@/lib/gateway/keys/auth";
import type { AuthenticateAgentApiKeyDeps } from "@/lib/gateway/keys/service";
import {
  executionTokenErrorStatus,
  getProposalExecutionStatus,
  type ExecutionTokenDeps,
} from "@/lib/gateway/tokens/service";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertUuid, secureError, secureJson } from "@/lib/security/api";

export interface ProposalStatusRequestDeps {
  authenticate: typeof authenticateAgentRequest;
  createAdmin: typeof createAdminClient;
  getStatus: typeof getProposalExecutionStatus;
}

const defaultDeps: ProposalStatusRequestDeps = {
  authenticate: authenticateAgentRequest,
  createAdmin: createAdminClient,
  getStatus: getProposalExecutionStatus,
};

export async function handleProposalStatusRequest(
  request: Request,
  proposalId: string,
  deps: ProposalStatusRequestDeps = defaultDeps,
  tokenDeps?: ExecutionTokenDeps,
  authDeps?: AuthenticateAgentApiKeyDeps
): Promise<NextResponse> {
  try {
    assertUuid(proposalId, "proposalId");
    const auth = await deps.authenticate(request, authDeps);
    const admin = deps.createAdmin();
    const result = await deps.getStatus(admin, auth, proposalId, tokenDeps);

    return secureJson(result);
  } catch (err) {
    if (err instanceof AgentAuthError) {
      return secureError(err.message, agentAuthErrorStatus(err.code), {
        code: err.code,
      });
    }

    if (err instanceof ExecutionTokenError) {
      return secureError(err.message, executionTokenErrorStatus(err.code), {
        code: err.code,
      });
    }

    if (err instanceof ProposalError) {
      const status = err.code === "agent_mismatch" ? 403 : 500;
      return secureError(err.message, status, { code: err.code });
    }

    const message =
      err instanceof Error ? err.message : "Failed to load proposal status.";
    return secureError(message, 500);
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ proposalId: string }> }
) {
  const { proposalId } = await context.params;
  return handleProposalStatusRequest(request, proposalId);
}
