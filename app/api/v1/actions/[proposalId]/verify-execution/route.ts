import { NextResponse } from "next/server";
import { AgentAuthError, ExecutionTokenError, ProposalError } from "@/lib/gateway/errors";
import {
  agentAuthErrorStatus,
  authenticateAgentRequest,
} from "@/lib/gateway/keys/auth";
import type { AuthenticateAgentApiKeyDeps } from "@/lib/gateway/keys/service";
import {
  executionTokenErrorStatus,
  verifyProposalExecution,
  type ExecutionTokenDeps,
} from "@/lib/gateway/tokens/service";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertUuid, parseJsonBody, secureError, secureJson } from "@/lib/security/api";
import { ValidationError } from "@/lib/security/errors";
import { verifyExecutionSchema } from "@/lib/security/validation";

export interface VerifyExecutionRequestDeps {
  authenticate: typeof authenticateAgentRequest;
  createAdmin: typeof createAdminClient;
  verify: typeof verifyProposalExecution;
}

const defaultDeps: VerifyExecutionRequestDeps = {
  authenticate: authenticateAgentRequest,
  createAdmin: createAdminClient,
  verify: verifyProposalExecution,
};

export async function handleVerifyExecutionRequest(
  request: Request,
  proposalId: string,
  deps: VerifyExecutionRequestDeps = defaultDeps,
  tokenDeps?: ExecutionTokenDeps,
  authDeps?: AuthenticateAgentApiKeyDeps
): Promise<NextResponse> {
  try {
    assertUuid(proposalId, "proposalId");
    const auth = await deps.authenticate(request, authDeps);
    const body = await parseJsonBody(request, verifyExecutionSchema);
    const admin = deps.createAdmin();

    const result = await deps.verify(
      admin,
      auth,
      proposalId,
      {
        executionToken: body.executionToken,
        toolName: body.toolName,
        actionType: body.actionType,
        payload: body.payload,
      },
      tokenDeps
    );

    return secureJson(result);
  } catch (err) {
    if (err instanceof ValidationError) {
      return secureError(err.message, 400, { details: err.details });
    }

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
      err instanceof Error ? err.message : "Failed to verify execution.";
    return secureError(message, 500);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ proposalId: string }> }
) {
  const { proposalId } = await context.params;
  return handleVerifyExecutionRequest(request, proposalId);
}
