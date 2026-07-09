import type { ApprovalStatus } from "@/lib/approval-types";
import type { RiskSeverity } from "@/lib/risk-types";

/** Matches public.audit_action enum in Supabase. */
export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "login"
  | "logout"
  | "approve"
  | "reject"
  | "escalate"
  | "upload"
  | "translate"
  | "analyze"
  | "notify"
  | "subscribe";

export interface AuditLogInput {
  organizationId?: string | null;
  userId: string;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  riskSeverity?: RiskSeverity | null;
  approvalStatus?: ApprovalStatus | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/** Timeline entry returned by GET /api/audit/timeline */
export interface AuditTimelineEntry {
  id: string;
  action: AuditAction;
  title: string;
  description: string;
  timestamp: string;
  actor: string;
  actorEmail: string | null;
  risk: RiskSeverity | null;
  approvalStatus: ApprovalStatus | null;
  ipAddress: string | null;
  userAgent: string | null;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown>;
  /** Dotted runtime gateway event name (e.g. proposal.created). */
  runtimeEvent?: string | null;
  proposalId?: string | null;
  source?: "retrospective" | "runtime";
}

export interface AuditTimelinePage {
  entries: AuditTimelineEntry[];
  nextCursor: string | null;
  hasMore: boolean;
}
