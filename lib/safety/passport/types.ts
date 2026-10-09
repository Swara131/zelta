import type { SafetyDecision } from "@/lib/safety/types";

export type ActionPassportStatus =
  | "active"
  | "pending_approval"
  | "used"
  | "revoked"
  | "expired";

export interface ActionPassportRecord {
  id: string;
  organizationId: string;
  builderAgentId: string;
  gatewayAgentId: string;
  agentRunId: string | null;
  agentActionId: string | null;
  actionProposalId: string | null;
  toolName: string;
  actionType: string;
  actionHash: string;
  parametersSnapshot: Record<string, unknown>;
  missionGoal: string | null;
  safetyDecision: SafetyDecision;
  status: ActionPassportStatus;
  expiresAt: string;
  usedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface CreateActionPassportInput {
  organizationId: string;
  builderAgentId: string;
  gatewayAgentId: string;
  agentRunId: string | null;
  agentActionId?: string | null;
  actionProposalId?: string | null;
  tool: string;
  action: string;
  parameters: Record<string, unknown>;
  missionGoal?: string | null;
  safetyDecision: SafetyDecision;
  expiresAt?: string;
  status?: ActionPassportStatus;
}

export interface ActionPassportCreated {
  passportId: string;
  actionHash: string;
  expiresAt: string;
}

export interface VerifyActionPassportInput {
  passportId: string;
  organizationId: string;
  builderAgentId: string;
  gatewayAgentId: string;
  agentRunId: string | null;
  missionGoal?: string | null;
  safetyDecision?: SafetyDecision;
  tool: string;
  action: string;
  parameters: Record<string, unknown>;
}

export interface ActionPassportVerification {
  valid: boolean;
  reason: string;
  passport?: ActionPassportRecord;
}

export interface ActionPassportStore {
  insert(record: Omit<ActionPassportRecord, "createdAt"> & { createdAt?: string }): Promise<ActionPassportRecord>;
  findById(id: string): Promise<ActionPassportRecord | null>;
  findByProposalId(proposalId: string): Promise<ActionPassportRecord | null>;
  consumeAtomically(params: {
    passportId: string;
    actionHash: string;
    usedAt: string;
    allowedStatuses?: ActionPassportStatus[];
  }): Promise<ActionPassportRecord | null>;
  revoke(passportId: string, revokedAt: string): Promise<ActionPassportRecord | null>;
}
