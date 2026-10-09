import { z } from "zod";
import { BUILDER_CAPABILITY_ID_VALUES } from "@/lib/agents/builder-capabilities";
import { ACCEPTED_EXTENSIONS } from "@/lib/types";
import { LOG_UPLOAD_MAX_BYTES } from "@/lib/storage/constants";

export const uuidSchema = z.string().uuid();

export const approvalDecisionSchema = z.object({
  decision: z.enum(["approved", "rejected", "changes_requested", "escalated"]),
  note: z
    .string()
    .trim()
    .max(2000, "Note must be 2000 characters or fewer.")
    .optional(),
});

export const translatorPostSchema = z
  .object({
    logContent: z.string().trim().max(5_000_000).optional(),
    filename: z.string().trim().max(255).nullable().optional(),
    uploadedLogId: uuidSchema.nullish(),
  })
  .refine(
    (data) => Boolean(data.uploadedLogId || data.logContent),
    "Provide uploadedLogId or logContent."
  );

export const billingCheckoutSchema = z.object({
  planId: z.enum(["professional", "team"]).default("professional"),
  interval: z.enum(["monthly", "yearly"]).default("monthly"),
});

export const approvalsGenerateSchema = z.object({
  riskAnalysisId: uuidSchema.optional(),
});

export const notificationRetryBatchSchema = z.object({
  limit: z.number().int().min(1).max(100).default(25),
});

export const agentBuilderGenerateSchema = z.object({
  description: z
    .string()
    .trim()
    .min(10, "Describe what your agent should do in a bit more detail.")
    .max(4000, "Description must be 4000 characters or fewer."),
});

export const agentBuildSentenceSchema = z.object({
  sentence: z
    .string()
    .trim()
    .min(20, "Description must be at least 20 characters.")
    .max(4000, "Description must be 4000 characters or fewer."),
});

const agentToolSpecSchema = z.object({
  id: z.string(),
  label: z.string(),
  icon: z.string(),
  toolName: z.string(),
  actionType: z.string(),
});

const protectionRuleSpecSchema = z.object({
  level: z.enum(["allow", "review", "block"]),
  label: z.string(),
  description: z.string(),
});

export const agentSpecSchema = z.object({
  name: z.string().trim().min(1),
  agentId: z.string().trim().min(1).max(128),
  summary: z.string(),
  purpose: z.string(),
  tools: z.array(agentToolSpecSchema).min(1),
  protection: z.array(protectionRuleSpecSchema),
  generatedAt: z.string(),
  source: z.enum(["groq", "fallback", "grok", "gemini"]),
  model: z.string().optional(),
});

export const createSimpleAgentSchema = z.object({
  description: z
    .string()
    .trim()
    .min(15, "Describe what your agent should do in a bit more detail.")
    .max(200, "Keep your description to 200 characters or fewer."),
});

export const createFromTemplateSchema = z.object({
  templateId: z
    .string()
    .trim()
    .min(1, "Template is required.")
    .max(64, "Invalid template id."),
  customizations: z.object({
    threshold: z
      .number()
      .int("Threshold must be a whole number.")
      .positive("Threshold must be greater than zero.")
      .max(10_000_000)
      .optional(),
    needsApproval: z.boolean(),
    customInstructions: z
      .string()
      .trim()
      .max(500, "Custom instructions must be 500 characters or fewer.")
      .optional(),
  }),
});

export const interpretAgentSchema = z.object({
  description: z
    .string()
    .trim()
    .min(15, "Describe what your agent should do in a bit more detail.")
    .max(500, "Keep your description to 500 characters or fewer."),
});

const builderCapabilityIdSchema = z.enum(BUILDER_CAPABILITY_ID_VALUES);

const builderScheduleSchema = z.object({
  when: z.enum(["manual", "daily", "weekly", "at_time", "on_event"]).optional(),
  time: z.string().trim().optional(),
  days: z.array(z.string().trim()).optional(),
  triggerType: z.enum(["email", "webhook", "schedule"]).optional(),
});

export const saveBuilderAgentDraftSchema = z.object({
  agentDbId: z.string().uuid().optional(),
  displayName: z
    .string()
    .trim()
    .min(2, "Agent name is required.")
    .max(50, "Agent name must be 50 characters or fewer."),
  goal: z
    .string()
    .trim()
    .min(10, "Describe what your agent does.")
    .max(2000, "Description is too long."),
  instructions: z.string().trim().max(4000).optional().default(""),
  scheduleSummary: z.string().trim().max(200).optional().default(""),
  schedule: builderScheduleSchema.optional().default({}),
  timezone: z.string().trim().max(64).optional().default("UTC"),
  capabilityIds: z.array(builderCapabilityIdSchema).min(1, "Pick at least one capability."),
  tools: z.array(z.string().trim().min(1)).optional(),
  triggerType: z.enum(["email", "webhook", "schedule"]),
  suggestedThreshold: z.number().int().positive().optional().default(5000),
  status: z.enum(["draft", "testing", "active"]).optional(),
  deliveryMode: z
    .enum(["email", "whatsapp", "notification", "both", "none"])
    .optional(),
  destinationEmail: z.string().email().optional().nullable(),
  destinationPhone: z.string().trim().min(8).max(20).optional().nullable(),
});

export const updateAgentSettingsSchema = z.object({
  deliveryMode: z.enum(["email", "whatsapp", "notification", "both", "none"]),
  destinationEmail: z.string().email().optional().nullable(),
  destinationPhone: z.string().trim().min(8).max(20).optional().nullable(),
  schedule: builderScheduleSchema.optional(),
  scheduleSummary: z.string().trim().max(200).optional(),
  timezone: z.string().trim().max(64).optional(),
});

export const updateAgentStatusSchema = z.object({
  status: z.enum(["active", "paused"]),
});

export const publishBuilderAgentSchema = z.object({
  agentDbId: z.string().uuid(),
});

const workflowNodeConfigSchema = z.record(z.string(), z.unknown()).optional().default({});

export const workflowGraphNodeSchema = z.object({
  id: z.string().trim().min(1).max(80),
  type: z.string().trim().min(1).max(64),
  category: z.enum(["trigger", "ai", "tool", "logic", "data", "output", "safety"]),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional().default(""),
  config: workflowNodeConfigSchema,
  status: z
    .enum(["idle", "valid", "warning", "error", "needs_connection"])
    .optional()
    .default("idle"),
  position: z.number().int().min(0),
  x: z.number().optional(),
  y: z.number().optional(),
});

export const workflowGraphEdgeSchema = z.object({
  id: z.string().trim().min(1).max(80),
  source: z.string().trim().min(1).max(80),
  target: z.string().trim().min(1).max(80),
  sourceHandle: z.string().trim().max(40).optional(),
  targetHandle: z.string().trim().max(40).optional(),
  label: z.string().trim().max(80).optional(),
});

export const workflowGraphSchema = z.object({
  version: z.number().int().min(1).default(1),
  nodes: z.array(workflowGraphNodeSchema).min(1),
  edges: z.array(workflowGraphEdgeSchema),
});

export const saveAgentWorkflowSchema = z.object({
  graph: workflowGraphSchema,
  displayName: z.string().trim().min(2).max(50).optional(),
  suggestedThreshold: z.number().int().positive().optional(),
  destinationEmail: z.string().email().optional().nullable(),
});

export const createBuilderAgentSchema = z.object({
  name: z
    .string()
    .trim()
    .min(4, "Agent name must be more than 3 characters.")
    .max(50, "Agent name must be 50 characters or fewer."),
  description: z
    .string()
    .trim()
    .min(11, "Description must be more than 10 characters.")
    .max(4000, "Description must be 4000 characters or fewer."),
  source: z.literal("zelta-builder").optional().default("zelta-builder"),
  tools: z
    .array(z.string().trim().min(1))
    .min(1, "At least one tool is required."),
  triggerType: z.preprocess(
    (value) => (typeof value === "string" ? value.trim().toLowerCase() : value),
    z.enum(["email", "webhook", "schedule"], {
      message: "Invalid trigger type. Must be email, webhook, or schedule.",
    })
  ),
  suggestedThreshold: z.number().int().positive().optional(),
});

export const createAgentFromSpecSchema = z.object({
  spec: agentSpecSchema,
  sentence: z.string().trim().optional(),
});

export const createAgentApiKeySchema = z.object({
  agentId: z
    .string()
    .trim()
    .min(1, "agentId is required.")
    .max(128, "agentId must be 128 characters or fewer."),
  name: z
    .string()
    .trim()
    .min(1, "name is required.")
    .max(128, "name must be 128 characters or fewer.")
    .default("Default key"),
  expiresAt: z.string().datetime().nullable().optional(),
});

export const proposeActionSchema = z
  .object({
    agentId: z
      .string()
      .trim()
      .min(1, "agentId is required.")
      .max(128, "agentId must be 128 characters or fewer."),
    toolName: z
      .string()
      .trim()
      .min(1, "toolName is required.")
      .max(256, "toolName must be 256 characters or fewer."),
    actionType: z
      .string()
      .trim()
      .min(1, "actionType is required.")
      .max(256, "actionType must be 256 characters or fewer."),
    payload: z.record(z.string(), z.unknown()).default({}),
    requestedBy: z.string().trim().max(256).optional(),
    idempotencyKey: z.string().trim().max(128).optional(),
  })
  .strict();

export const verifyExecutionSchema = z
  .object({
    executionToken: z
      .string()
      .trim()
      .min(1, "executionToken is required.")
      .max(512, "executionToken must be 512 characters or fewer."),
    toolName: z
      .string()
      .trim()
      .min(1, "toolName is required.")
      .max(256, "toolName must be 256 characters or fewer."),
    actionType: z
      .string()
      .trim()
      .min(1, "actionType is required.")
      .max(256, "actionType must be 256 characters or fewer."),
    payload: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();

export const auditTimelineQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().max(512).nullable().optional(),
  action: z
    .enum([
      "create",
      "update",
      "delete",
      "login",
      "logout",
      "approve",
      "reject",
      "escalate",
      "upload",
      "translate",
      "analyze",
      "notify",
      "subscribe",
    ])
    .nullable()
    .optional(),
});

export const MAX_FILENAME_LENGTH = 255;

const allowedExtensions = ACCEPTED_EXTENSIONS as unknown as readonly string[];

export const filenameSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_FILENAME_LENGTH)
  .refine((name) => !name.includes("..") && !name.includes("/") && !name.includes("\\"), {
    message: "Filename contains invalid path characters.",
  })
  .refine((name) => !/[\0\r\n]/.test(name), {
    message: "Filename contains invalid control characters.",
  })
  .refine((name) => {
    const ext = `.${name.split(".").pop()?.toLowerCase() ?? ""}`;
    return allowedExtensions.includes(ext);
  }, "Unsupported file extension.");

export const fileUploadSchema = z.object({
  size: z.number().int().positive().max(LOG_UPLOAD_MAX_BYTES),
  name: filenameSchema,
  type: z.string().max(128).optional(),
});

export function formatZodError(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    return `${path}${issue.message}`;
  });
}
