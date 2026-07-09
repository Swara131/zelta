import { z } from "zod";
import {
  AiProposalEnrichmentError,
  AiRiskAnalysisError,
  AiTranslationError,
} from "./errors";

export function parseJsonText(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      return JSON.parse(fenced[1].trim());
    }
    const objectStart = trimmed.indexOf("{");
    const objectEnd = trimmed.lastIndexOf("}");
    if (objectStart !== -1 && objectEnd > objectStart) {
      return JSON.parse(trimmed.slice(objectStart, objectEnd + 1));
    }
    const arrayStart = trimmed.indexOf("[");
    const arrayEnd = trimmed.lastIndexOf("]");
    if (arrayStart !== -1 && arrayEnd > arrayStart) {
      return JSON.parse(trimmed.slice(arrayStart, arrayEnd + 1));
    }
    throw new Error("Model returned invalid JSON.");
  }
}

const translationRowSchema = z.object({
  lineNumber: z.coerce.number().optional(),
  action: z.string().optional(),
  explanation: z.string().optional(),
  affectedSystem: z.string().optional(),
  affectedUser: z.string().optional(),
  timestamp: z.string().optional(),
  businessImpact: z.string().optional(),
  aiConfidence: z.coerce.number().optional(),
});

export type ParsedTranslationRow = z.infer<typeof translationRowSchema>;

export function parseTranslationsPayload(
  raw: unknown
): ParsedTranslationRow[] {
  const wrapped = z.object({ translations: z.array(translationRowSchema).min(1) });
  const wrappedResult = wrapped.safeParse(raw);
  if (wrappedResult.success) {
    return wrappedResult.data.translations;
  }

  const arrayResult = z.array(translationRowSchema).min(1).safeParse(raw);
  if (arrayResult.success) {
    return arrayResult.data;
  }

  throw new AiTranslationError(
    "Groq response did not match the expected translation JSON schema."
  );
}

const riskRowSchema = z.object({
  title: z.string().optional(),
  severity: z.string().optional(),
  riskLevel: z.string().optional(),
  explanation: z.string().optional(),
  reason: z.string().optional(),
  businessImpact: z.string().optional(),
  complianceImpact: z.string().optional(),
  mitreAttack: z
    .object({
      tactic: z.string().optional(),
      technique: z.string().optional(),
      techniqueId: z.string().optional(),
    })
    .optional(),
  owaspCategory: z.string().optional(),
  suggestedAction: z.string().optional(),
  confidence: z.coerce.number().optional(),
  aiRecommendation: z.string().optional(),
  relatedEvents: z
    .array(
      z.object({
        title: z.string().optional(),
        timestamp: z.string().optional(),
        severity: z.string().optional(),
      })
    )
    .optional(),
  detectedAt: z.string().optional(),
  sourceLog: z.string().optional(),
});

export type ParsedRiskRow = z.infer<typeof riskRowSchema>;

export const riskResponseSchema = z.object({
  overallScore: z.coerce.number().optional(),
  riskLevel: z.string().optional(),
  risks: z.array(riskRowSchema).min(1),
});

export type ParsedRiskResponse = z.infer<typeof riskResponseSchema>;

export function parseRiskPayload(raw: unknown): ParsedRiskResponse {
  const result = riskResponseSchema.safeParse(raw);
  if (!result.success) {
    throw new AiRiskAnalysisError(
      "Groq response did not match the expected risk analysis JSON schema."
    );
  }
  return result.data;
}

export const proposalEnrichmentSchema = z.object({
  plainEnglishSummary: z.string().trim().min(1),
  riskScore: z.coerce.number().min(0).max(100),
  riskLevel: z.enum(["critical", "high", "medium", "low"]),
  riskSignals: z.array(z.string().trim().min(1)).default([]),
  riskReasons: z.array(z.string().trim().min(1)).min(1),
  reviewerAssistance: z.string().trim().min(1),
});

export type ParsedProposalEnrichment = z.infer<typeof proposalEnrichmentSchema>;

export function parseProposalEnrichmentPayload(
  raw: unknown
): ParsedProposalEnrichment {
  const result = proposalEnrichmentSchema.safeParse(raw);
  if (!result.success) {
    throw new AiProposalEnrichmentError(
      "Groq response did not match the expected proposal enrichment JSON schema."
    );
  }
  return result.data;
}
