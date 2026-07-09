import { NextResponse } from "next/server";
import { AgentAuthError, ProposalError } from "@/lib/gateway/errors";
import {
  agentAuthErrorStatus,
  authenticateAgentRequest,
} from "@/lib/gateway/keys/auth";
import type { AuthenticateAgentApiKeyDeps } from "@/lib/gateway/keys/service";
import { proposeAction, type ProposeActionDeps } from "@/lib/gateway/proposals/service";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseJsonBody, secureError, secureJson } from "@/lib/security/api";
import { ValidationError } from "@/lib/security/errors";
import { proposeActionSchema } from "@/lib/security/validation";

export interface ProposeActionRequestDeps {
  authenticate: (
    request: Request,
    authDeps?: AuthenticateAgentApiKeyDeps
  ) => Promise<Awaited<ReturnType<typeof authenticateAgentRequest>>>;
  propose: typeof proposeAction;
  createAdmin: typeof createAdminClient;
}

const defaultRequestDeps: ProposeActionRequestDeps = {
  authenticate: authenticateAgentRequest,
  propose: proposeAction,
  createAdmin: createAdminClient,
};

export async function handleProposeActionRequest(
  request: Request,
  deps: ProposeActionRequestDeps = defaultRequestDeps,
  authDeps?: AuthenticateAgentApiKeyDeps,
  proposeDeps?: ProposeActionDeps
): Promise<NextResponse> {
  try {
    const auth = await deps.authenticate(request, authDeps);
    const body = await parseJsonBody(request, proposeActionSchema);
    const admin = deps.createAdmin();

    const result = await deps.propose(
      admin,
      auth,
      {
        agentId: body.agentId,
        toolName: body.toolName,
        actionType: body.actionType,
        payload: body.payload,
        requestedBy: body.requestedBy,
        idempotencyKey: body.idempotencyKey,
      },
      proposeDeps
    );

    return secureJson(result, { status: 201 });
  } catch (err) {
    if (err instanceof ValidationError) {
      return secureError(err.message, 400, { details: err.details });
    }

    if (err instanceof AgentAuthError) {
      return secureError(err.message, agentAuthErrorStatus(err.code), {
        code: err.code,
      });
    }

    if (err instanceof ProposalError) {
      const status = err.code === "agent_mismatch" ? 403 : 500;
      return secureError(err.message, status, { code: err.code });
    }

    const message =
      err instanceof Error ? err.message : "Failed to propose action.";
    return secureError(message, 500);
  }
}

export async function POST(request: Request) {
  return handleProposeActionRequest(request);
}
