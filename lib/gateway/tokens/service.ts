import type { SupabaseClient } from "@supabase/supabase-js";
import { ExecutionTokenError } from "@/lib/gateway/errors";
import type { AgentAuthContext } from "@/lib/gateway/types";
import {
  recordRuntimeAuditEventAsync,
  type RuntimeAuditEventName,
} from "@/lib/gateway/audit/runtime-events";
import { computeActionHash } from "@/lib/gateway/proposals/canonicalize";
import type { ActionProposalRow } from "@/lib/gateway/proposals/repository";
import { assertAgentMatchesAuth } from "@/lib/gateway/proposals/service";
import { EXECUTION_TOKEN_TTL_SECONDS } from "./constants";
import {
  generateExecutionTokenMaterial,
  hashExecutionToken,
  isPlausibleExecutionToken,
  verifyExecutionToken,
} from "./crypto";
import {
  consumeExecutionTokenAtomically,
  getActiveExecutionTokenForProposal,
  getExecutionTokenByHash,
  getProposalForAgentExecution,
  insertExecutionToken,
} from "./repository";
import type {
  ExternalProposalStatus,
  ProposalStatusResponse,
  VerifyExecutionInput,
  VerifyExecutionResult,
} from "./types";

export interface ExecutionTokenDeps {
  getProposal: typeof getProposalForAgentExecution;
  getActiveToken: typeof getActiveExecutionTokenForProposal;
  insertToken: typeof insertExecutionToken;
  getTokenByHash: typeof getExecutionTokenByHash;
  consumeToken: typeof consumeExecutionTokenAtomically;
  generateToken: typeof generateExecutionTokenMaterial;
  hashToken: typeof hashExecutionToken;
  verifyToken: typeof verifyExecutionToken;
  computeHash: typeof computeActionHash;
}

const defaultDeps: ExecutionTokenDeps = {
  getProposal: getProposalForAgentExecution,
  getActiveToken: getActiveExecutionTokenForProposal,
  insertToken: insertExecutionToken,
  getTokenByHash: getExecutionTokenByHash,
  consumeToken: consumeExecutionTokenAtomically,
  generateToken: generateExecutionTokenMaterial,
  hashToken: hashExecutionToken,
  verifyToken: verifyExecutionToken,
  computeHash: computeActionHash,
};

function computeTokenExpiresAt(from = new Date()): string {
  return new Date(from.getTime() + EXECUTION_TOKEN_TTL_SECONDS * 1000).toISOString();
}

function recordRuntimeEvent(
  supabase: SupabaseClient,
  params: {
    organizationId: string;
    proposalId: string;
    event: RuntimeAuditEventName;
    agentId?: string | null;
    metadata?: Record<string, unknown>;
  }
): void {
  recordRuntimeAuditEventAsync(supabase, {
    organizationId: params.organizationId,
    proposalId: params.proposalId,
    event: params.event,
    agentId: params.agentId ?? null,
    metadata: params.metadata,
  });
}

function denyExecution(
  supabase: SupabaseClient,
  params: {
    organizationId: string;
    proposalId: string;
    agentId: string;
    reason: string;
    code: ExecutionTokenError["code"];
    toolName?: string;
    actionType?: string;
  }
): never {
  recordRuntimeEvent(supabase, {
    organizationId: params.organizationId,
    proposalId: params.proposalId,
    event: "execution.denied",
    agentId: params.agentId,
    metadata: {
      reason: params.reason,
      code: params.code,
      toolName: params.toolName,
      actionType: params.actionType,
    },
  });
  throw new ExecutionTokenError(params.reason, params.code);
}

export function resolveExternalProposalStatus(
  row: ActionProposalRow,
  now = new Date()
): ExternalProposalStatus {
  if (row.status === "rejected") {
    return "rejected";
  }

  if (row.status === "blocked") {
    return "blocked";
  }

  if (row.status === "expired") {
    return "expired";
  }

  if (new Date(row.expires_at) <= now) {
    return "expired";
  }

  if (row.status === "approved" || row.status === "allowed") {
    return "approved";
  }

  return "pending";
}

function isExecutionEligible(row: ActionProposalRow, now = new Date()): boolean {
  return (
    resolveExternalProposalStatus(row, now) === "approved" &&
    row.status !== "executed"
  );
}

export async function getProposalExecutionStatus(
  supabase: SupabaseClient,
  auth: AgentAuthContext,
  proposalId: string,
  deps: ExecutionTokenDeps = defaultDeps
): Promise<ProposalStatusResponse> {
  const proposal = await deps.getProposal(supabase, {
    proposalId,
    organizationId: auth.organizationId,
    agentId: auth.agentId,
  });

  if (!proposal) {
    throw new ExecutionTokenError("Action proposal not found.", "not_found");
  }

  const status = resolveExternalProposalStatus(proposal);
  const response: ProposalStatusResponse = {
    proposalId: proposal.id,
    status,
    actionHash: proposal.action_hash,
  };

  if (status === "expired") {
    recordRuntimeEvent(supabase, {
      organizationId: auth.organizationId,
      proposalId: proposal.id,
      event: "proposal.expired",
      agentId: auth.agentId,
      metadata: {
        toolName: proposal.tool_name,
        actionType: proposal.action_type,
        expiresAt: proposal.expires_at,
      },
    });
    return response;
  }

  if (!isExecutionEligible(proposal)) {
    return response;
  }

  const existing = await deps.getActiveToken(supabase, {
    proposalId: proposal.id,
    organizationId: auth.organizationId,
  });

  if (existing) {
    return {
      ...response,
      executionTokenIssued: true,
      executionTokenExpiresAt: existing.expires_at,
    };
  }

  const material = deps.generateToken();
  const expiresAt = computeTokenExpiresAt();

  await deps.insertToken(supabase, {
    organizationId: auth.organizationId,
    actionProposalId: proposal.id,
    tokenHash: material.tokenHash,
    tokenPrefix: material.tokenPrefix,
    expiresAt,
  });

  recordRuntimeEvent(supabase, {
    organizationId: auth.organizationId,
    proposalId: proposal.id,
    event: "token.issued",
    agentId: auth.agentId,
    metadata: {
      actionHash: proposal.action_hash,
      tokenPrefix: material.tokenPrefix,
      expiresAt,
    },
  });

  return {
    ...response,
    executionToken: material.plainToken,
    executionTokenExpiresAt: expiresAt,
    executionTokenIssued: true,
  };
}

export async function verifyProposalExecution(
  supabase: SupabaseClient,
  auth: AgentAuthContext,
  proposalId: string,
  input: VerifyExecutionInput,
  deps: ExecutionTokenDeps = defaultDeps
): Promise<VerifyExecutionResult> {
  if (!isPlausibleExecutionToken(input.executionToken)) {
    throw new ExecutionTokenError("Invalid execution token.", "token_mismatch");
  }

  const proposal = await deps.getProposal(supabase, {
    proposalId,
    organizationId: auth.organizationId,
    agentId: auth.agentId,
  });

  if (!proposal) {
    throw new ExecutionTokenError("Action proposal not found.", "not_found");
  }

  assertAgentMatchesAuth(auth, proposal.agent_id);

  const baseDeny = {
    organizationId: auth.organizationId,
    proposalId: proposal.id,
    agentId: auth.agentId,
    toolName: input.toolName,
    actionType: input.actionType,
  };

  if (resolveExternalProposalStatus(proposal) !== "approved") {
    denyExecution(supabase, {
      ...baseDeny,
      reason: "Proposal is not approved for execution.",
      code: "not_eligible",
    });
  }

  if (proposal.tool_name.trim() !== input.toolName.trim()) {
    denyExecution(supabase, {
      ...baseDeny,
      reason: "toolName does not match the approved action.",
      code: "tool_mismatch",
    });
  }

  if (proposal.action_type.trim() !== input.actionType.trim()) {
    denyExecution(supabase, {
      ...baseDeny,
      reason: "actionType does not match the approved action.",
      code: "action_type_mismatch",
    });
  }

  const recomputedHash = deps.computeHash({
    organizationId: auth.organizationId,
    agentId: proposal.agent_id,
    toolName: input.toolName,
    actionType: input.actionType,
    payload: input.payload,
  });

  if (recomputedHash !== proposal.action_hash) {
    denyExecution(supabase, {
      ...baseDeny,
      reason: "Payload does not match the approved action hash.",
      code: "payload_mismatch",
    });
  }

  const tokenHash = deps.hashToken(input.executionToken);
  const stored = await deps.getTokenByHash(supabase, tokenHash);

  if (!stored) {
    denyExecution(supabase, {
      ...baseDeny,
      reason: "Execution token not found.",
      code: "token_mismatch",
    });
  }

  if (stored.organization_id !== auth.organizationId) {
    denyExecution(supabase, {
      ...baseDeny,
      reason: "Execution token organization mismatch.",
      code: "organization_mismatch",
    });
  }

  if (stored.action_proposal_id !== proposalId) {
    denyExecution(supabase, {
      ...baseDeny,
      reason: "Execution token does not match this proposal.",
      code: "proposal_mismatch",
    });
  }

  if (!deps.verifyToken(input.executionToken, stored.token_hash)) {
    denyExecution(supabase, {
      ...baseDeny,
      reason: "Execution token verification failed.",
      code: "token_mismatch",
    });
  }

  const now = new Date();

  if (stored.status === "used") {
    denyExecution(supabase, {
      ...baseDeny,
      reason: "Execution token has already been used.",
      code: "replayed",
    });
  }

  if (stored.status !== "active") {
    denyExecution(supabase, {
      ...baseDeny,
      reason: "Execution token is not active.",
      code: "not_eligible",
    });
  }

  if (new Date(stored.expires_at) <= now) {
    denyExecution(supabase, {
      ...baseDeny,
      reason: "Execution token has expired.",
      code: "expired",
    });
  }

  recordRuntimeEvent(supabase, {
    organizationId: auth.organizationId,
    proposalId: proposal.id,
    event: "token.verified",
    agentId: auth.agentId,
    metadata: {
      actionHash: proposal.action_hash,
      tokenPrefix: stored.token_prefix,
      toolName: input.toolName,
      actionType: input.actionType,
    },
  });

  const consumedAt = now.toISOString();
  const consumed = await deps.consumeToken(supabase, {
    tokenHash: stored.token_hash,
    proposalId,
    organizationId: auth.organizationId,
    consumedAt,
  });

  if (!consumed) {
    denyExecution(supabase, {
      ...baseDeny,
      reason: "Execution token was already consumed or expired.",
      code: "concurrent_use",
    });
  }

  recordRuntimeEvent(supabase, {
    organizationId: auth.organizationId,
    proposalId: proposal.id,
    event: "token.consumed",
    agentId: auth.agentId,
    metadata: {
      actionHash: proposal.action_hash,
      tokenPrefix: stored.token_prefix,
      consumedAt,
    },
  });

  return {
    allowed: true,
    proposalId: proposal.id,
    actionHash: proposal.action_hash,
    consumedAt,
  };
}

export function executionTokenErrorStatus(
  code: ExecutionTokenError["code"]
): number {
  switch (code) {
    case "not_found":
      return 404;
    case "not_eligible":
    case "expired":
    case "replayed":
    case "token_mismatch":
    case "payload_mismatch":
    case "tool_mismatch":
    case "action_type_mismatch":
    case "organization_mismatch":
    case "proposal_mismatch":
    case "concurrent_use":
      return 403;
    default:
      return 400;
  }
}
