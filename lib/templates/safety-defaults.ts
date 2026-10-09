import type {
  TemplateApprovalRule,
  TemplateDataProtection,
  TemplateExecutionLimits,
  TemplateRiskLevel,
  TemplateToolPermission,
} from "./types";

export interface TemplateSafetyDefaults {
  preset: "safe" | "balanced" | "autonomous";
  requiresApproval: boolean;
  startPaused: boolean;
  autoAllow: boolean;
  requireApprovalFor: string[];
  toolPermissions: TemplateToolPermission[];
  approvalRules: TemplateApprovalRule[];
  executionLimits: TemplateExecutionLimits;
  dataProtection: TemplateDataProtection;
  riskExplanation: string;
}

const LOW_SENSITIVE = new Set(["issue_refund", "send_email", "send_whatsapp_message"]);

export function safetyDefaultsForRisk(
  riskLevel: TemplateRiskLevel,
  tools: string[]
): TemplateSafetyDefaults {
  const writeTools = tools.filter((tool) => LOW_SENSITIVE.has(tool) || tool === "update_crm_record" || tool === "http_request");

  if (riskLevel === "low") {
    return {
      preset: "safe",
      requiresApproval: false,
      startPaused: false,
      autoAllow: true,
      requireApprovalFor: [],
      toolPermissions: tools.map((tool) => ({
        tool,
        permission: writeTools.includes(tool) ? "draft_only" : "read_only",
      })),
      approvalRules: [
        { id: "no-payments", label: "No payment, deletion, publishing, or mass-messaging", required: true },
      ],
      executionLimits: {
        maxToolCallsPerRun: 15,
        maxRunDurationMs: 120_000,
        dailySpendingCapUsd: 5,
        maxMessagesPerRun: 5,
      },
      dataProtection: {
        promptInjectionDefense: true,
        piiRedaction: true,
        secretDetection: true,
        auditLogs: true,
        emergencyPause: true,
      },
      riskExplanation:
        "This template is set up for research and drafts. It cannot send payments, delete records, publish content, or message many people at once. You can loosen these later after you review the agent.",
    };
  }

  if (riskLevel === "medium") {
    return {
      preset: "balanced",
      requiresApproval: true,
      startPaused: false,
      autoAllow: false,
      requireApprovalFor: writeTools,
      toolPermissions: tools.map((tool) => ({
        tool,
        permission: writeTools.includes(tool) ? "ask_approval" : "read_only",
      })),
      approvalRules: [
        { id: "external-writes", label: "Approval required for external write actions", required: true },
      ],
      executionLimits: {
        maxToolCallsPerRun: 40,
        maxRunDurationMs: 300_000,
        dailySpendingCapUsd: 25,
        maxMessagesPerRun: 20,
      },
      dataProtection: {
        promptInjectionDefense: true,
        piiRedaction: true,
        secretDetection: true,
        auditLogs: true,
        emergencyPause: true,
      },
      riskExplanation:
        "This template can prepare real work (messages, record updates) but Wave asks you before those actions go out. Review permissions before you turn the agent on.",
    };
  }

  return {
    preset: "safe",
    requiresApproval: true,
    startPaused: true,
    autoAllow: false,
    requireApprovalFor: [
      "send_email",
      "send_whatsapp_message",
      "delete_crm_record",
      "issue_refund",
      "update_crm_record",
      "http_request",
      ...writeTools,
    ].filter((tool, index, list) => list.indexOf(tool) === index),
    toolPermissions: tools.map((tool) => ({
      tool,
      permission: "ask_approval",
    })),
    approvalRules: [
      { id: "every-sensitive", label: "Approval required for messages, publishing, refunds, deletions, and exports", required: true },
      { id: "no-auto-pay", label: "Automatic payment and refund execution is off", required: true },
      { id: "no-bulk", label: "Automatic bulk messaging is off", required: true },
      { id: "no-delete", label: "Automatic deletion is off", required: true },
      { id: "no-tax-file", label: "Automatic tax filing is off", required: true },
    ],
    executionLimits: {
      maxToolCallsPerRun: 12,
      maxRunDurationMs: 90_000,
      dailySpendingCapUsd: 5,
      maxMessagesPerRun: 3,
    },
    dataProtection: {
      promptInjectionDefense: true,
      piiRedaction: true,
      secretDetection: true,
      auditLogs: true,
      emergencyPause: true,
    },
    riskExplanation:
      "This template can affect customers, money, or production systems. It starts paused. Wave requires your approval for every sensitive action. It will not automatically send bulk messages, issue refunds, delete data, or file taxes.",
  };
}

export function mapTriggerToRuntime(
  trigger: "email" | "webhook" | "schedule" | "manual" | "inbox" | undefined
): "email" | "webhook" | "schedule" {
  if (trigger === "email" || trigger === "inbox") return "email";
  if (trigger === "schedule") return "schedule";
  return "webhook";
}
