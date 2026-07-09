import { z } from "zod";
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
    uploadedLogId: uuidSchema.optional(),
  })
  .refine(
    (data) => Boolean(data.uploadedLogId || data.logContent),
    "Provide uploadedLogId or logContent."
  );

export const billingCheckoutSchema = z.object({
  planId: z.enum(["professional"]).default("professional"),
  interval: z.enum(["monthly", "yearly"]).default("monthly"),
});

export const approvalsGenerateSchema = z.object({
  riskAnalysisId: uuidSchema.optional(),
});

export const notificationRetryBatchSchema = z.object({
  limit: z.number().int().min(1).max(100).default(25),
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
