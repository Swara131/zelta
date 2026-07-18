import { z } from "zod";
import { GatewayError } from "@/lib/gateway/errors";

/** Shadow classifier risk level (aligned with org-wide risk severity). */
export const shadowRiskLevelSchema = z.enum(["low", "medium", "high", "critical"]);

export type ShadowRiskLevel = z.infer<typeof shadowRiskLevelSchema>;

/** Signal severity within a shadow assessment (no critical tier). */
export const shadowRiskSignalSeveritySchema = z.enum(["low", "medium", "high"]);

export type ShadowRiskSignalSeverity = z.infer<typeof shadowRiskSignalSeveritySchema>;

/**
 * Shadow classifier may recommend allow or review only — never autonomous block.
 * Policy BLOCK remains deterministic and authoritative.
 */
export const shadowRecommendedDecisionSchema = z.enum(["allow", "review"]);

export type ShadowRecommendedDecision = z.infer<typeof shadowRecommendedDecisionSchema>;

export const shadowRiskSignalSchema = z
  .object({
    code: z.string().trim().min(1),
    description: z.string().trim().min(1),
    severity: shadowRiskSignalSeveritySchema,
  })
  .strict();

export type ShadowRiskSignal = z.infer<typeof shadowRiskSignalSchema>;

export const riskSignalWithSourceSchema = shadowRiskSignalSchema.extend({
  source: z.enum(["deterministic", "contextual"]),
});

export type RiskSignalWithSource = z.infer<typeof riskSignalWithSourceSchema>;

export const shadowRiskAssessmentSchema = z
  .object({
    riskLevel: shadowRiskLevelSchema,
    score: z.number().min(0).max(100),
    confidence: z.number().min(0).max(1),
    reasons: z.array(z.string().trim().min(1)),
    signals: z.array(shadowRiskSignalSchema),
    recommendedDecision: shadowRecommendedDecisionSchema,
    modelProvider: z.string().trim().min(1),
    modelName: z.string().trim().min(1),
    classifierVersion: z.string().trim().min(1),
  })
  .strict();

export type ShadowRiskAssessment = z.infer<typeof shadowRiskAssessmentSchema>;

/** Unified explainable shadow assessment combining deterministic facts and LLM context. */
export const explainableRiskAssessmentSchema = z
  .object({
    riskLevel: shadowRiskLevelSchema,
    score: z.number().min(0).max(100),
    confidence: z.number().min(0).max(1),
    reasons: z.array(z.string().trim().min(1)),
    signalCodes: z.array(z.string().trim().min(1)),
    signals: z.array(riskSignalWithSourceSchema),
    deterministicSignalCodes: z.array(z.string().trim().min(1)),
    contextualSignals: z.array(shadowRiskSignalSchema),
    recommendedDecision: shadowRecommendedDecisionSchema,
    modelProvider: z.string().trim().min(1),
    modelName: z.string().trim().min(1),
    classifierVersion: z.string().trim().min(1),
    classifierStatus: z.literal("completed"),
    latencyMs: z.number().min(0),
  })
  .strict();

export type ExplainableRiskAssessment = z.infer<typeof explainableRiskAssessmentSchema>;

/** Model-facing subset — provider metadata is added server-side after validation. */
export const shadowClassifierModelOutputSchema = shadowRiskAssessmentSchema.omit({
  modelProvider: true,
  modelName: true,
  classifierVersion: true,
});

export type ShadowClassifierModelOutput = z.infer<typeof shadowClassifierModelOutputSchema>;

export class ShadowRiskAssessmentError extends GatewayError {
  readonly details: z.ZodIssue[];

  constructor(message: string, details: z.ZodIssue[] = []) {
    super(message);
    this.name = "ShadowRiskAssessmentError";
    this.details = details;
  }
}

/** Strict runtime validation for shadow risk classifier output. */
export function parseShadowRiskAssessment(raw: unknown): ShadowRiskAssessment {
  const result = shadowRiskAssessmentSchema.safeParse(raw);

  if (!result.success) {
    throw new ShadowRiskAssessmentError(
      "Shadow risk assessment did not match the expected schema.",
      result.error.issues
    );
  }

  return result.data;
}

/** Validates untrusted model JSON before provider metadata is attached. */
export function parseShadowClassifierModelOutput(
  raw: unknown
): ShadowClassifierModelOutput {
  const result = shadowClassifierModelOutputSchema.safeParse(raw);

  if (!result.success) {
    throw new ShadowRiskAssessmentError(
      "Shadow classifier model output did not match the expected schema.",
      result.error.issues
    );
  }

  return result.data;
}

/** Strict runtime validation for unified explainable shadow assessments. */
export function parseExplainableRiskAssessment(raw: unknown): ExplainableRiskAssessment {
  const result = explainableRiskAssessmentSchema.safeParse(raw);

  if (!result.success) {
    throw new ShadowRiskAssessmentError(
      "Explainable risk assessment did not match the expected schema.",
      result.error.issues
    );
  }

  return result.data;
}
