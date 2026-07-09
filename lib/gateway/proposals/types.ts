export type GatewayProposalStatus =
  | "pending"
  | "allowed"
  | "review_required"
  | "approved"
  | "rejected"
  | "blocked"
  | "expired"
  | "executed";

export interface ProposeActionInput {
  agentId: string;
  toolName: string;
  actionType: string;
  payload: Record<string, unknown>;
  requestedBy?: string;
  idempotencyKey?: string;
}

export interface StoredActionProposal {
  id: string;
  organizationId: string;
  agentId: string;
  toolName: string;
  actionType: string;
  actionPayload: Record<string, unknown>;
  actionHash: string;
  status: GatewayProposalStatus;
  expiresAt: string;
  createdAt: string;
}

export interface ProposeActionResponse {
  proposalId: string;
  status: GatewayProposalStatus;
  actionHash: string;
  decision: "ALLOW" | "REVIEW" | "BLOCK";
  matchedPolicies: Array<{
    policyId: string;
    name: string;
    decision: "ALLOW" | "REVIEW" | "BLOCK";
    reason: string;
  }>;
}
