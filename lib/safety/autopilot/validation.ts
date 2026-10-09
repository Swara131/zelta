import { z } from "zod";

export const protectionModeSchema = z.enum(["safe", "balanced", "autonomous"]);

export const toolPermissionLevelSchema = z.enum([
  "disabled",
  "read_only",
  "draft_only",
  "ask_approval",
  "automatic",
]);

export const approvalRuleKeySchema = z.enum([
  "send_message",
  "publish_content",
  "delete_data",
  "process_payments",
  "change_production_code",
  "export_customer_data",
  "access_secrets",
]);

export const dataProtectionSchema = z.object({
  promptInjectionDefense: z.boolean(),
  secretDetection: z.boolean(),
  piiDetection: z.boolean(),
  blockPromptExtraction: z.boolean(),
  restrictSensitiveKb: z.boolean(),
});

export const executionLimitsSchema = z.object({
  maxCostPerRunUsd: z.number().min(0).max(10_000).nullable(),
  dailySpendingCapUsd: z.number().min(0).max(100_000).nullable(),
  maxToolCallsPerRun: z.number().int().min(1).max(10_000).nullable(),
  maxExecutionTimeSeconds: z.number().int().min(10).max(86_400).nullable(),
  maxRetries: z.number().int().min(0).max(20).nullable(),
  maxMessagesPerRun: z.number().int().min(0).max(10_000).nullable(),
});

export const updateProtectionModeSchema = z.object({
  mode: protectionModeSchema,
  confirmRiskIncrease: z.boolean().optional(),
});

export const updateToolPermissionSchema = z.object({
  toolId: z.string().trim().min(1).max(64),
  permissionLevel: toolPermissionLevelSchema,
  confirmAutomatic: z.boolean().optional(),
});

export const updateApprovalRulesSchema = z.object({
  rules: z.array(
    z.object({
      ruleKey: approvalRuleKeySchema,
      enabled: z.boolean(),
      thresholdValue: z.number().min(0).max(10_000_000).nullable().optional(),
      thresholdUnit: z.string().max(32).nullable().optional(),
    })
  ),
});

export const updateDataProtectionSchema = dataProtectionSchema;

export const updateExecutionLimitsSchema = executionLimitsSchema;

export const fixRecommendationSchema = z.object({
  recommendationId: z.string().trim().min(1).max(128),
});

export const emergencyActionSchema = z.object({
  action: z.enum(["pause_agent", "resume_agent", "revoke_permissions", "kill_active_runs"]),
  confirm: z.literal(true),
});

export const activityFilterSchema = z.object({
  severity: z.enum(["info", "warning", "blocked", "critical"]).optional(),
  tool: z.string().max(64).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
