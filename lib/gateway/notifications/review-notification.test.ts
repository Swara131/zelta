import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActionProposalRow } from "@/lib/gateway/proposals/repository";
import type { NotificationRow } from "@/lib/email/repository";
import type { RiskSeverity } from "@/lib/risk-types";
import {
  buildGatewayReviewNotificationParams,
  notifyGatewayReviewRequired,
} from "./review-notification";

const ORG = "11111111-1111-4111-8111-111111111111";
const PROPOSAL_ID = "44444444-4444-4444-8444-444444444444";

async function mockCreateApprovalLinks() {
  const token = "al_rev_testtoken123";
  return {
    approveUrl: `https://app.example.com/approve/${token}`,
    denyUrl: `https://app.example.com/deny/${token}`,
    reviewUrl: `https://app.example.com/approvals?proposal=${encodeURIComponent(PROPOSAL_ID)}`,
    tokenPrefix: "al_rev_test",
  };
}

function mockEmailReviewer() {
  return {
    id: "user-1",
    email: "reviewer@example.com",
    full_name: "Reviewer",
    approval_email_enabled: true,
    approval_whatsapp_enabled: false,
    approval_dashboard_enabled: true,
    whatsapp_phone_e164: null,
    whatsapp_phone_verified_at: null,
  };
}

function mockNotificationRow(channel: "email" | "whatsapp" = "email"): NotificationRow {
  const severity: RiskSeverity = "high";
  return {
    id: channel === "email" ? "notif-1" : "notif-wa-1",
    organization_id: ORG,
    user_id: "user-1",
    approval_request_id: PROPOSAL_ID,
    risk_analysis_id: null,
    risk_title: "issue_refund",
    risk_id: PROPOSAL_ID,
    severity,
    status: "unread",
    channel,
    delivery_status: "pending",
    recipient: "Reviewer",
    recipient_email: channel === "email" ? "reviewer@example.com" : null,
    recipient_phone: channel === "whatsapp" ? "+919876543210" : null,
    subject: "subject",
    preview: "preview",
    retry_count: 0,
    max_retries: 3,
    template_type: "gateway_review_requested",
    template_payload: {
      proposalId: PROPOSAL_ID,
      agentId: "refund-agent-01",
      toolName: "issue_refund",
      actionType: "financial.refund",
      plainEnglishSummary: "Refund request for customer",
      riskLevel: "high",
      riskScore: 75,
      riskReasons: ["High-value transaction"],
      reviewDeadline: new Date(Date.now() + 14_400_000).toISOString(),
      approvalsUrl: "https://app.example.com/approvals",
      approveUrl: "https://app.example.com/approve/token",
      rejectUrl: "https://app.example.com/deny/token",
      recipientName: "Reviewer",
    },
    provider_message_id: null,
    last_error: null,
    sent_at: null,
    created_at: new Date().toISOString(),
  };
}

function buildReviewRow(overrides: Partial<ActionProposalRow> = {}): ActionProposalRow {
  return {
    id: PROPOSAL_ID,
    organization_id: ORG,
    agent_id: "refund-agent-01",
    tool_name: "issue_refund",
    action_type: "financial.refund",
    action_payload: { amount: 100 },
    action_hash: "hash-abc",
    plain_english_summary: "Refund request for customer",
    risk_level: "high",
    risk_score: 75,
    risk_reasons: {
      matchedPolicies: [
        { name: "Large refund", decision: "REVIEW", reason: "Amount threshold exceeded" },
      ],
      ai: { riskReasons: ["High-value transaction"] },
    },
    policy_decision: "review",
    status: "review_required",
    requested_by: null,
    idempotency_key: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    review_expires_at: new Date(Date.now() + 14_400_000).toISOString(),
    decided_at: new Date().toISOString(),
    executed_at: null,
    ...overrides,
  };
}

describe("buildGatewayReviewNotificationParams", () => {
  it("returns null for ALLOW proposals", () => {
    assert.equal(
      buildGatewayReviewNotificationParams(buildReviewRow({ status: "allowed" }), "hash"),
      null
    );
  });

  it("returns null for BLOCK proposals", () => {
    assert.equal(
      buildGatewayReviewNotificationParams(buildReviewRow({ status: "blocked" }), "hash"),
      null
    );
  });

  it("returns null when shadow recommends review but status is ALLOW", () => {
    assert.equal(
      buildGatewayReviewNotificationParams(
        buildReviewRow({
          status: "allowed",
          risk_reasons: {
            matchedPolicies: [],
            shadow: {
              mode: "shadow",
              status: "completed",
              assessment: { recommendedDecision: "review", riskLevel: "critical" },
            } as never,
          },
        }),
        "hash"
      ),
      null
    );
  });

  it("builds params for deterministic REVIEW proposals", () => {
    const params = buildGatewayReviewNotificationParams(buildReviewRow(), "hash-abc");
    assert.ok(params);
    assert.equal(params!.proposalId, PROPOSAL_ID);
  });

  it("returns null for non-review proposals (legacy alias)", () => {
    assert.equal(
      buildGatewayReviewNotificationParams(
        buildReviewRow({ status: "allowed" }),
        "hash-abc"
      ),
      null
    );
  });

  it("builds params from persisted review row", () => {
    const params = buildGatewayReviewNotificationParams(buildReviewRow(), "hash-abc");
    assert.ok(params);
    assert.equal(params!.proposalId, PROPOSAL_ID);
    assert.equal(params!.riskLevel, "high");
    assert.ok(params!.reviewExpiresAt);
  });
});

describe("notifyGatewayReviewRequired", () => {
  it("sends email after queue with audit lifecycle", async () => {
    const auditEvents: string[] = [];
    let delivered = false;

    const result = await notifyGatewayReviewRequired(
      {} as SupabaseClient,
      {
        organizationId: ORG,
        proposalId: PROPOSAL_ID,
        agentId: "refund-agent-01",
        toolName: "issue_refund",
        actionType: "financial.refund",
        actionHash: "hash-abc",
        plainEnglishSummary: "Refund request",
        riskLevel: "high",
        riskScore: 75,
        riskReasons: {
          matchedPolicies: [
            { name: "Large refund", decision: "REVIEW", reason: "Threshold exceeded" },
          ],
        },
        reviewExpiresAt: new Date(Date.now() + 14_400_000).toISOString(),
      },
      {
        getReviewers: async () => [mockEmailReviewer()],
        findExistingEmail: async () => null,
        findExistingWhatsApp: async () => null,
        createEmailRecord: async () => mockNotificationRow("email"),
        createWhatsAppRecord: async () => mockNotificationRow("whatsapp"),
        deliverEmail: async () => {
          delivered = true;
        },
        deliverWhatsApp: async () => {},
        recordAudit: (_supabase, params) => {
          auditEvents.push(params.event);
        },
        createApprovalLinks: mockCreateApprovalLinks,
      }
    );

    assert.equal(result.sent, 1);
    assert.equal(result.skipped, 0);
    assert.equal(result.failed, 0);
    assert.equal(delivered, true);
    assert.deepEqual(auditEvents, [
      "notification.queued",
      "notification.sent",
    ]);
  });

  it("skips when a prior failed notification exists (explicit retry path only)", async () => {
    const result = await notifyGatewayReviewRequired(
      {} as SupabaseClient,
      {
        organizationId: ORG,
        proposalId: PROPOSAL_ID,
        agentId: "refund-agent-01",
        toolName: "issue_refund",
        actionType: "financial.refund",
        actionHash: "hash-abc",
        plainEnglishSummary: "Refund request",
        riskLevel: "medium",
        riskScore: 40,
        riskReasons: [],
        reviewExpiresAt: new Date(Date.now() + 14_400_000).toISOString(),
      },
      {
        getReviewers: async () => [mockEmailReviewer()],
        findExistingEmail: async () =>
          ({
            id: "failed-1",
            delivery_status: "failed",
            retry_count: 1,
            max_retries: 3,
          }) as never,
        findExistingWhatsApp: async () => null,
        createEmailRecord: async () => {
          throw new Error("should not create when failed record exists");
        },
        createWhatsAppRecord: async () => mockNotificationRow("whatsapp"),
        deliverEmail: async () => {
          throw new Error("should not auto-deliver failed record");
        },
        deliverWhatsApp: async () => {},
        recordAudit: () => {},
        createApprovalLinks: mockCreateApprovalLinks,
      }
    );

    assert.equal(result.skipped, 1);
    assert.equal(result.sent, 0);
  });

  it("skips concurrent duplicate insert unique violations", async () => {
    const result = await notifyGatewayReviewRequired(
      {} as SupabaseClient,
      {
        organizationId: ORG,
        proposalId: PROPOSAL_ID,
        agentId: "refund-agent-01",
        toolName: "issue_refund",
        actionType: "financial.refund",
        actionHash: "hash-abc",
        plainEnglishSummary: "Refund request",
        riskLevel: "medium",
        riskScore: 40,
        riskReasons: [],
        reviewExpiresAt: new Date(Date.now() + 14_400_000).toISOString(),
      },
      {
        getReviewers: async () => [mockEmailReviewer()],
        findExistingEmail: async () => null,
        findExistingWhatsApp: async () => null,
        createEmailRecord: async () => {
          const err = new Error(
            'duplicate key value violates unique constraint "notifications_active_gateway_review_dedupe_idx"'
          ) as Error & { code?: string };
          err.code = "23505";
          throw err;
        },
        createWhatsAppRecord: async () => mockNotificationRow("whatsapp"),
        deliverEmail: async () => {
          throw new Error("should not deliver on duplicate insert");
        },
        deliverWhatsApp: async () => {},
        recordAudit: () => {},
        createApprovalLinks: mockCreateApprovalLinks,
      }
    );

    assert.equal(result.skipped, 1);
    assert.equal(result.sent, 0);
  });

  it("skips duplicate notifications for the same proposal and recipient", async () => {
    const result = await notifyGatewayReviewRequired(
      {} as SupabaseClient,
      {
        organizationId: ORG,
        proposalId: PROPOSAL_ID,
        agentId: "refund-agent-01",
        toolName: "issue_refund",
        actionType: "financial.refund",
        actionHash: "hash-abc",
        plainEnglishSummary: "Refund request",
        riskLevel: "medium",
        riskScore: 40,
        riskReasons: [],
        reviewExpiresAt: new Date(Date.now() + 14_400_000).toISOString(),
      },
      {
        getReviewers: async () => [mockEmailReviewer()],
        findExistingEmail: async () => ({ id: "existing" } as never),
        findExistingWhatsApp: async () => null,
        createEmailRecord: async () => {
          throw new Error("should not create duplicate");
        },
        createWhatsAppRecord: async () => mockNotificationRow("whatsapp"),
        deliverEmail: async () => {
          throw new Error("should not deliver duplicate");
        },
        deliverWhatsApp: async () => {},
        recordAudit: () => {},
        createApprovalLinks: mockCreateApprovalLinks,
      }
    );

    assert.equal(result.sent, 0);
    assert.equal(result.skipped, 1);
  });

  it("sends WhatsApp when reviewer has verified WhatsApp enabled", async () => {
    let whatsappDelivered = false;

    const result = await notifyGatewayReviewRequired(
      {} as SupabaseClient,
      {
        organizationId: ORG,
        proposalId: PROPOSAL_ID,
        agentId: "refund-agent-01",
        toolName: "issue_refund",
        actionType: "financial.refund",
        actionPayload: { customerName: "Priya Singh", amount: 800_000, currency: "INR" },
        actionHash: "hash-abc",
        plainEnglishSummary: "Refund request",
        riskLevel: "high",
        riskScore: 72,
        riskReasons: [],
        reviewExpiresAt: new Date(Date.now() + 14_400_000).toISOString(),
      },
      {
        getReviewers: async () => [
          {
            ...mockEmailReviewer(),
            approval_email_enabled: false,
            approval_whatsapp_enabled: true,
            whatsapp_phone_e164: "+919876543210",
            whatsapp_phone_verified_at: new Date().toISOString(),
          },
        ],
        findExistingEmail: async () => null,
        findExistingWhatsApp: async () => null,
        createEmailRecord: async () => mockNotificationRow("email"),
        createWhatsAppRecord: async () => mockNotificationRow("whatsapp"),
        deliverEmail: async () => {},
        deliverWhatsApp: async () => {
          whatsappDelivered = true;
        },
        recordAudit: () => {},
        createApprovalLinks: mockCreateApprovalLinks,
      }
    );

    assert.equal(result.sent, 1);
    assert.equal(whatsappDelivered, true);
  });

  it("does not throw when delivery fails", async () => {
    const auditEvents: string[] = [];

    const result = await notifyGatewayReviewRequired(
      {} as SupabaseClient,
      {
        organizationId: ORG,
        proposalId: PROPOSAL_ID,
        agentId: "refund-agent-01",
        toolName: "issue_refund",
        actionType: "financial.refund",
        actionHash: "hash-abc",
        plainEnglishSummary: "Refund request",
        riskLevel: "low",
        riskScore: 10,
        riskReasons: [],
        reviewExpiresAt: new Date(Date.now() + 14_400_000).toISOString(),
      },
      {
        getReviewers: async () => [mockEmailReviewer()],
        findExistingEmail: async () => null,
        findExistingWhatsApp: async () => null,
        createEmailRecord: async () => ({
          ...mockNotificationRow("email"),
          id: "notif-2",
          severity: "low",
        }),
        createWhatsAppRecord: async () => mockNotificationRow("whatsapp"),
        deliverEmail: async () => {
          throw new Error("Resend unavailable");
        },
        deliverWhatsApp: async () => {},
        recordAudit: (_supabase, params) => {
          auditEvents.push(params.event);
        },
        createApprovalLinks: mockCreateApprovalLinks,
      }
    );

    assert.equal(result.failed, 1);
    assert.ok(auditEvents.includes("notification.queued"));
    assert.ok(auditEvents.includes("notification.failed"));
  });
});
