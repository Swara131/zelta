import { parseJsonText } from "@/lib/groq/json";
import { grokJsonCompletion } from "./client";
import type { PolicyDecisionOutcome } from "@/lib/gateway/policy/types";
import { AGENT_BUILD_PARSE_ERROR } from "./errors";
import { getGrokModel } from "./env";

export type GrokRiskBand = "ALLOW" | "APPROVAL_REQUIRED" | "BLOCK";

export interface ActionRiskPayload {
  toolName: string;
  actionType?: string;
  [key: string]: unknown;
}

export type GrokRiskFactorDirection = "increase" | "decrease";

export interface GrokRiskFactor {
  label: string;
  weight: number;
  direction: GrokRiskFactorDirection;
}

export interface GrokActionRiskResult {
  risk_score: number;
  reason: string;
  factors: GrokRiskFactor[];
  decision: GrokRiskBand;
  policyDecision: PolicyDecisionOutcome;
  model: string;
}

export class GrokRiskScoringError extends Error {
  readonly code: "parse_error" | "provider_error";

  constructor(code: GrokRiskScoringError["code"], message: string) {
    super(message);
    this.name = "GrokRiskScoringError";
    this.code = code;
  }
}

export const GROK_RISK_PARSE_ERROR = AGENT_BUILD_PARSE_ERROR;

export const GROK_RISK_SERVICE_UNAVAILABLE =
  "Service temporarily unavailable. Please try again.";

function buildRiskScorePrompt(payload: ActionRiskPayload): string {
  return `Score the risk of this action from 0 to 1, where 0 is safe and 1 is dangerous.
Consider: amount, tool type, customer history, frequency, timing, and reversibility.
Explain your reasoning with weighted factors that contributed to the score.

Return ONLY a JSON object:
{
  "risk_score": 0.82,
  "reason": "high amount for refund",
  "factors": [
    { "label": "Amount exceeds ₹5,000 threshold", "weight": 0.4, "direction": "increase" },
    { "label": "Customer has strong rating", "weight": 0.02, "direction": "decrease" }
  ]
}

Rules for factors:
- Include 2-6 specific, human-readable factors.
- weight is a decimal between 0 and 1 representing how much that factor moved the score.
- direction is "increase" for risk-raising factors and "decrease" for risk-lowering factors.
- Do not include secrets or raw credentials in labels.

Action: ${JSON.stringify(payload)}`;
}

function clampRiskScore(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

export function decisionFromRiskScore(riskScore: number): GrokRiskBand {
  const score = clampRiskScore(riskScore);

  if (score < 0.3) {
    return "ALLOW";
  }

  if (score <= 0.8) {
    return "APPROVAL_REQUIRED";
  }

  return "BLOCK";
}

export function toPolicyDecision(decision: GrokRiskBand): PolicyDecisionOutcome {
  if (decision === "APPROVAL_REQUIRED") {
    return "REVIEW";
  }

  return decision;
}

function parseGrokRiskFactors(raw: unknown): GrokRiskFactor[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const factors: GrokRiskFactor[] = [];

  for (const item of raw) {
    if (typeof item !== "object" || item === null) {
      continue;
    }

    const record = item as Record<string, unknown>;
    const label = typeof record.label === "string" ? record.label.trim() : "";
    const weight = record.weight;
    const direction = record.direction;

    if (!label || typeof weight !== "number" || !Number.isFinite(weight)) {
      continue;
    }

    if (direction !== "increase" && direction !== "decrease") {
      continue;
    }

    factors.push({
      label,
      weight: clampRiskScore(weight),
      direction,
    });
  }

  return factors.slice(0, 8);
}

export function parseGrokRiskScorePayload(raw: unknown): {
  risk_score: number;
  reason: string;
  factors: GrokRiskFactor[];
} {
  if (!raw || typeof raw !== "object") {
    throw new GrokRiskScoringError("parse_error", GROK_RISK_PARSE_ERROR);
  }

  const record = raw as Record<string, unknown>;
  const riskScore = record.risk_score;

  if (typeof riskScore !== "number" || !Number.isFinite(riskScore)) {
    throw new GrokRiskScoringError("parse_error", GROK_RISK_PARSE_ERROR);
  }

  if (typeof record.reason !== "string" || !record.reason.trim()) {
    throw new GrokRiskScoringError("parse_error", GROK_RISK_PARSE_ERROR);
  }

  return {
    risk_score: clampRiskScore(riskScore),
    reason: record.reason.trim(),
    factors: parseGrokRiskFactors(record.factors),
  };
}

export async function scoreActionRiskWithGrok(
  payload: ActionRiskPayload,
  completeJson: typeof grokJsonCompletion = grokJsonCompletion
): Promise<GrokActionRiskResult> {
  const rawText = await completeJson(buildRiskScorePrompt(payload));

  let parsed: unknown;
  try {
    parsed = parseJsonText(rawText);
  } catch {
    throw new GrokRiskScoringError("parse_error", GROK_RISK_PARSE_ERROR);
  }

  const { risk_score, reason, factors } = parseGrokRiskScorePayload(parsed);
  const decision = decisionFromRiskScore(risk_score);

  return {
    risk_score,
    reason,
    factors,
    decision,
    policyDecision: toPolicyDecision(decision),
    model: getGrokModel(),
  };
}

export function mergePolicyDecisions(
  deterministic: PolicyDecisionOutcome,
  aiDecision: PolicyDecisionOutcome
): PolicyDecisionOutcome {
  const rank: Record<PolicyDecisionOutcome, number> = {
    ALLOW: 0,
    REVIEW: 1,
    BLOCK: 2,
  };

  return rank[aiDecision] > rank[deterministic] ? aiDecision : deterministic;
}

export function riskScoreToStoredInteger(riskScore: number): number {
  return Math.round(clampRiskScore(riskScore) * 100);
}

export function riskScoreToRiskLevel(
  riskScore: number
): "low" | "medium" | "high" | "critical" {
  const score = clampRiskScore(riskScore);

  if (score < 0.3) {
    return "low";
  }

  if (score <= 0.6) {
    return "medium";
  }

  if (score <= 0.8) {
    return "high";
  }

  return "critical";
}
