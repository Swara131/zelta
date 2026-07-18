import type { SupabaseClient } from "@supabase/supabase-js";

/** Public dotted event names for runtime gateway audit. */
export type RuntimeAuditEventName =
  | "proposal.created"
  | "policy.allow"
  | "policy.review"
  | "policy.block"
  | "ai.risk_analyzed"
  | "ai.risk_failed"
  | "shadow.risk_analyzed"
  | "shadow.risk_failed"
  | "risk.assessment_started"
  | "risk.assessment_completed"
  | "risk.assessment_failed"
  | "decision.composed"
  | "approval.approved"
  | "approval.rejected"
  | "token.issued"
  | "token.verified"
  | "token.consumed"
  | "execution.denied"
  | "proposal.expired"
  | "review.deadline_set"
  | "review.expired"
  | "review.auto_denied"
  | "review.escalated"
  | "notification.queued"
  | "notification.sent"
  | "notification.failed";

export type GatewayAuditDbEventType =
  | "proposal_created"
  | "policy_allow"
  | "policy_review"
  | "policy_block"
  | "ai_risk_analyzed"
  | "ai_risk_failed"
  | "approval_approved"
  | "approval_rejected"
  | "token_issued"
  | "token_verified"
  | "token_consumed"
  | "execution_denied"
  | "proposal_expired"
  | "human_approved"
  | "human_rejected"
  | "review_requested"
  | "decision_recorded"
  | "proposal_received"
  | "policy_evaluated"
  | "risk_scored";

export const RUNTIME_EVENT_TO_DB: Record<RuntimeAuditEventName, GatewayAuditDbEventType> = {
  "proposal.created": "proposal_created",
  "policy.allow": "policy_allow",
  "policy.review": "policy_review",
  "policy.block": "policy_block",
  "ai.risk_analyzed": "ai_risk_analyzed",
  "ai.risk_failed": "ai_risk_failed",
  "shadow.risk_analyzed": "ai_risk_analyzed",
  "shadow.risk_failed": "ai_risk_failed",
  "risk.assessment_started": "risk_scored",
  "risk.assessment_completed": "ai_risk_analyzed",
  "risk.assessment_failed": "ai_risk_failed",
  "decision.composed": "decision_recorded",
  "approval.approved": "approval_approved",
  "approval.rejected": "approval_rejected",
  "token.issued": "token_issued",
  "token.verified": "token_verified",
  "token.consumed": "token_consumed",
  "execution.denied": "execution_denied",
  "proposal.expired": "proposal_expired",
  "review.deadline_set": "review_requested",
  "review.expired": "proposal_expired",
  "review.auto_denied": "approval_rejected",
  "review.escalated": "review_requested",
  "notification.queued": "review_requested",
  "notification.sent": "decision_recorded",
  "notification.failed": "ai_risk_failed",
};

/** Legacy DB enum values mapped to dotted runtime names for timeline display. */
export const LEGACY_DB_EVENT_TO_RUNTIME: Partial<
  Record<GatewayAuditDbEventType, RuntimeAuditEventName>
> = {
  human_approved: "approval.approved",
  human_rejected: "approval.rejected",
  token_issued: "token.issued",
  token_consumed: "token.consumed",
  proposal_expired: "proposal.expired",
  review_requested: "policy.review",
  proposal_received: "proposal.created",
};

export const DB_EVENT_TO_RUNTIME: Partial<Record<GatewayAuditDbEventType, RuntimeAuditEventName>> =
  {
    ...Object.fromEntries(
      Object.entries(RUNTIME_EVENT_TO_DB).map(([runtime, db]) => [db, runtime])
    ),
    ...LEGACY_DB_EVENT_TO_RUNTIME,
  } as Partial<Record<GatewayAuditDbEventType, RuntimeAuditEventName>>;

const SECRET_KEY_PATTERN =
  /^(executiontoken|execution_token|token|apikey|api_key|plainkey|plain_key|secret|password|authorization|service_role|service_role_key|key_hash|token_hash|resend_api_key)$/i;

const SECRET_VALUE_PATTERN = /^(et_|al_)[a-z0-9_+-]+$/i;

function isSecretKey(key: string): boolean {
  return SECRET_KEY_PATTERN.test(key.trim());
}

function sanitizeValue(key: string, value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (isSecretKey(key)) {
      return "[redacted]";
    }
    if (SECRET_VALUE_PATTERN.test(trimmed) && trimmed.length > 16) {
      return "[redacted]";
    }
    return trimmed;
  }

  if (Array.isArray(value)) {
    return value.map((item, index) => sanitizeValue(`${key}[${index}]`, item));
  }

  if (typeof value === "object") {
    return sanitizeMetadata(value as Record<string, unknown>);
  }

  return value;
}

/** Removes secrets, raw tokens, and API key material from audit metadata. */
export function sanitizeAuditMetadata(
  metadata: Record<string, unknown> = {}
): Record<string, unknown> {
  return sanitizeMetadata(metadata);
}

function sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (isSecretKey(key)) {
      sanitized[key] = "[redacted]";
      continue;
    }
    sanitized[key] = sanitizeValue(key, value);
  }

  return sanitized;
}

export interface RecordRuntimeAuditParams {
  organizationId: string;
  proposalId: string;
  event: RuntimeAuditEventName;
  agentId?: string | null;
  actorId?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Writes an append-only gateway runtime audit event via service role.
 * Failures are logged and never thrown.
 */
export async function recordRuntimeAuditEvent(
  supabase: SupabaseClient,
  params: RecordRuntimeAuditParams
): Promise<void> {
  const dbEventType = RUNTIME_EVENT_TO_DB[params.event];
  const metadata = sanitizeAuditMetadata({
    ...params.metadata,
    event: params.event,
    proposalId: params.proposalId,
  });

  try {
    const { error } = await supabase.from("audit_events").insert({
      organization_id: params.organizationId,
      action_proposal_id: params.proposalId,
      event_type: dbEventType,
      actor_id: params.actorId ?? null,
      agent_id: params.agentId ?? null,
      metadata,
      ip_address: params.ipAddress ?? null,
      user_agent: params.userAgent ?? null,
    });

    if (error) {
      console.error("[runtime-audit] Failed to record event:", params.event, error.message);
    }
  } catch (err) {
    console.error("[runtime-audit] Failed to record event:", params.event, err);
  }
}

export function recordRuntimeAuditEventAsync(
  supabase: SupabaseClient,
  params: RecordRuntimeAuditParams
): void {
  void recordRuntimeAuditEvent(supabase, params);
}
