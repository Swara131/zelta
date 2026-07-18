import { groqJsonCompletion } from "@/lib/groq/client";
import { getGroqModel } from "@/lib/groq/env";
import { parseJsonText } from "@/lib/groq/json";
import { GatewayError } from "@/lib/gateway/errors";
import type { PolicyDecisionOutcome } from "@/lib/gateway/policy/types";
import {
  parseShadowClassifierModelOutput,
  parseShadowRiskAssessment,
  type ShadowRiskAssessment,
} from "./assessment";
import type { DeterministicRiskSignal, RiskContext } from "./signals";
import { sanitizeRiskContextForClassifier } from "./signals";

/** Bumped when prompt or validation rules change. */
export const SHADOW_CLASSIFIER_VERSION = "shadow-v1.2.0";

export const SHADOW_CLASSIFIER_PROVIDER = "groq";

/** Default Groq call budget for shadow classification. */
export const SHADOW_CLASSIFIER_TIMEOUT_MS = 15_000;

const FORBIDDEN_CONTEXT_KEY =
  /^(authorization|cookie|apikey|api_key|executiontoken|execution_token|token|secret|password|service_role|service_role_key|key_hash|token_hash|plainkey|plain_key|resend_api_key)$/i;

const SECRET_VALUE_PATTERN = /^(et_|al_)[a-z0-9_+-]+$/i;

export interface ShadowRiskClassifierContext {
  agentId: string;
  toolName: string;
  actionType: string;
  payload: Record<string, unknown>;
  /** Read-only context for shadow comparison — never overridden by classifier output. */
  policyDecision?: PolicyDecisionOutcome;
  matchedPolicyNames?: string[];
  /** Deterministic risk context extracted before provider call. */
  riskContext?: RiskContext;
  /** Structured deterministic signals (authoritative, pre-classifier). */
  deterministicSignals?: DeterministicRiskSignal[];
}

export type ShadowRiskClassifierErrorCode =
  | "timeout"
  | "provider_failure"
  | "malformed_json"
  | "validation_error";

export class ShadowRiskClassifierError extends GatewayError {
  readonly code: ShadowRiskClassifierErrorCode;

  constructor(code: ShadowRiskClassifierErrorCode, message: string) {
    super(message);
    this.name = "ShadowRiskClassifierError";
    this.code = code;
  }
}

export interface ShadowRiskClassifierDeps {
  completeJson?: typeof groqJsonCompletion;
  getModel?: typeof getGroqModel;
  timeoutMs?: number;
  /** Lower temperature for more stable structured shadow output. */
  temperature?: number;
}

function sanitizeUnknown(value: unknown, key = ""): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (FORBIDDEN_CONTEXT_KEY.test(key)) {
      return "[redacted]";
    }
    if (SECRET_VALUE_PATTERN.test(trimmed) && trimmed.length > 16) {
      return "[redacted]";
    }
    return trimmed;
  }

  if (Array.isArray(value)) {
    return value.map((item, index) => sanitizeUnknown(item, `${key}[${index}]`));
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const sanitized: Record<string, unknown> = {};

    for (const [entryKey, entryValue] of Object.entries(record)) {
      if (FORBIDDEN_CONTEXT_KEY.test(entryKey)) {
        sanitized[entryKey] = "[redacted]";
        continue;
      }
      sanitized[entryKey] = sanitizeUnknown(entryValue, entryKey);
    }

    return sanitized;
  }

  return value;
}

/** Redacts secrets from agent context before any provider call. */
export function sanitizeShadowClassifierContext(
  context: ShadowRiskClassifierContext
): ShadowRiskClassifierContext {
  return {
    agentId: context.agentId.trim(),
    toolName: context.toolName.trim(),
    actionType: context.actionType.trim(),
    payload: sanitizeUnknown(context.payload) as Record<string, unknown>,
    policyDecision: context.policyDecision,
    matchedPolicyNames: context.matchedPolicyNames?.map((name) => name.trim()),
    riskContext: context.riskContext,
    deterministicSignals: context.deterministicSignals,
  };
}

function buildClassifierPrompt(context: ShadowRiskClassifierContext): string {
  const riskSummary = context.riskContext
    ? JSON.stringify(sanitizeRiskContextForClassifier(context.riskContext))
    : "unavailable";
  const deterministicSignals = JSON.stringify(context.deterministicSignals ?? []);

  return `You are a shadow contextual risk interpreter for an AI agent approval gateway.

IMPORTANT:
- Return advisory JSON only.
- recommendedDecision MUST be "allow" or "review" only — NEVER "block".
- Do not include chain-of-thought, reasoning traces, or hidden analysis fields.
- Provide concise user-facing reasons only (max 5, one sentence each).
- Deterministic policy (if provided) is authoritative; your output is shadow/advisory only.
- Deterministic risk context and signals below are authoritative facts — interpret them, do NOT invent or contradict facts.
- Contextual signals you add must use code prefix "contextual." and must not restate deterministic fact codes.
- If critical/high risk or low confidence, recommend "review".

Proposed action summary:
Agent: ${context.agentId}
Tool: ${context.toolName}
Action type: ${context.actionType}
Policy decision (read-only): ${context.policyDecision ?? "unknown"}
Matched policies: ${JSON.stringify(context.matchedPolicyNames ?? [])}
Risk context (deterministic): ${riskSummary}
Deterministic signals (authoritative facts): ${deterministicSignals}

Return ONLY valid JSON with this exact shape:
{
  "riskLevel": "critical" | "high" | "medium" | "low",
  "score": 0-100,
  "confidence": 0-1,
  "reasons": ["concise user-facing reason"],
  "signals": [
    {
      "code": "contextual.interpretation.code",
      "description": "short contextual interpretation",
      "severity": "low" | "medium" | "high"
    }
  ],
  "recommendedDecision": "allow" | "review"
}`;
}

async function withClassifierTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(
            new ShadowRiskClassifierError(
              "timeout",
              `Shadow risk classifier timed out after ${timeoutMs}ms.`
            )
          );
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}

function toValidationError(err: unknown): ShadowRiskClassifierError {
  return new ShadowRiskClassifierError(
    "validation_error",
    err instanceof Error ? err.message : "Shadow risk assessment validation failed."
  );
}

/**
 * Standalone shadow risk classifier — advisory only, not wired to live policy.
 * Reuses Groq JSON completion; validates all model output before returning.
 */
export async function classifyRisk(
  sanitizedContext: ShadowRiskClassifierContext,
  deps: ShadowRiskClassifierDeps = {}
): Promise<ShadowRiskAssessment> {
  const completeJson = deps.completeJson ?? groqJsonCompletion;
  const getModel = deps.getModel ?? getGroqModel;
  const timeoutMs = deps.timeoutMs ?? SHADOW_CLASSIFIER_TIMEOUT_MS;
  const temperature = deps.temperature ?? 0.1;
  const context = sanitizeShadowClassifierContext(sanitizedContext);
  const modelName = getModel();

  let rawText: string;

  try {
    rawText = await withClassifierTimeout(
      completeJson(buildClassifierPrompt(context), {
        kind: "risk",
        system:
          "Respond with valid JSON only. Shadow advisory interpreter: recommend allow or review only; never block; never invent facts.",
        temperature,
      }),
      timeoutMs
    );
  } catch (err) {
    if (err instanceof ShadowRiskClassifierError) {
      throw err;
    }
    const message = err instanceof Error ? err.message : "Shadow classifier provider failed.";
    throw new ShadowRiskClassifierError("provider_failure", message);
  }

  let parsed: unknown;
  try {
    parsed = parseJsonText(rawText);
  } catch {
    throw new ShadowRiskClassifierError(
      "malformed_json",
      "Shadow classifier returned malformed JSON."
    );
  }

  let modelOutput;
  try {
    modelOutput = parseShadowClassifierModelOutput(parsed);
  } catch (err) {
    throw toValidationError(err);
  }

  try {
    return parseShadowRiskAssessment({
      ...modelOutput,
      modelProvider: SHADOW_CLASSIFIER_PROVIDER,
      modelName,
      classifierVersion: SHADOW_CLASSIFIER_VERSION,
    });
  } catch (err) {
    throw toValidationError(err);
  }
}
