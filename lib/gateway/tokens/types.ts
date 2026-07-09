export type ExternalProposalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "blocked"
  | "expired";

export type ExecutionTokenStatus = "active" | "used" | "revoked" | "expired";

export interface ExecutionTokenRow {
  id: string;
  organization_id: string;
  action_proposal_id: string;
  token_hash: string;
  token_prefix: string;
  status: ExecutionTokenStatus;
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProposalStatusResponse {
  proposalId: string;
  status: ExternalProposalStatus;
  actionHash: string;
  /** Raw token — returned only once when newly issued to an authorized agent. */
  executionToken?: string;
  executionTokenExpiresAt?: string;
  executionTokenIssued?: boolean;
}

export interface VerifyExecutionInput {
  executionToken: string;
  toolName: string;
  actionType: string;
  payload: Record<string, unknown>;
}

export interface VerifyExecutionResult {
  allowed: true;
  proposalId: string;
  actionHash: string;
  consumedAt: string;
}
