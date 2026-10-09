import { createHash } from "crypto";
import { normalizePayload } from "@/lib/gateway/proposals/canonicalize";
import { sanitizeActionParameters } from "@/lib/safety/sanitize";
import type { SafetyDecision } from "@/lib/safety/types";

/** Keys injected at runtime or generated per request — excluded from action hash. */
const RUNTIME_ONLY_KEYS = new Set([
  "_zeltaruntimerunid",
  "_zeltaruntimesource",
  "_zeltabuilderagentid",
  "passportid",
  "agentactionid",
  "proposalid",
  "requestid",
  "correlationid",
  "traceid",
  "spanid",
  "timestamp",
  "createdat",
  "updatedat",
  "generatedat",
  "expiresat",
  "usedat",
  "revokedat",
]);

function stripIrrelevantKeys(
  parameters: Record<string, unknown>
): Record<string, unknown> {
  const stripped: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parameters)) {
    if (RUNTIME_ONLY_KEYS.has(key.toLowerCase())) {
      continue;
    }
    stripped[key] = value;
  }
  return stripped;
}

export interface ActionHashInput {
  organizationId: string;
  builderAgentId: string;
  gatewayAgentId: string;
  agentRunId: string | null;
  missionGoal?: string | null;
  safetyDecision?: SafetyDecision;
  tool: string;
  action: string;
  parameters: Record<string, unknown>;
}

export interface PassportCanonicalAction {
  organizationId: string;
  builderAgentId: string;
  gatewayAgentId: string;
  agentRunId: string;
  missionGoal: string | null;
  authorizationContext: {
    safetyDecision: SafetyDecision;
  };
  tool: string;
  action: string;
  parameters: Record<string, unknown>;
}

function normalizeMissionGoal(missionGoal?: string | null): string | null {
  const trimmed = missionGoal?.trim();
  return trimmed ? trimmed : null;
}

export function canonicalizePassportAction(
  params: ActionHashInput
): PassportCanonicalAction {
  const sanitized = sanitizeActionParameters(
    stripIrrelevantKeys(params.parameters)
  );

  return {
    organizationId: params.organizationId.trim(),
    builderAgentId: params.builderAgentId.trim(),
    gatewayAgentId: params.gatewayAgentId.trim(),
    agentRunId: (params.agentRunId ?? "no-run").trim(),
    missionGoal: normalizeMissionGoal(params.missionGoal),
    authorizationContext: {
      safetyDecision: params.safetyDecision ?? "ALLOW",
    },
    tool: params.tool.trim(),
    action: params.action.trim(),
    parameters: normalizePayload(sanitized) as Record<string, unknown>,
  };
}

/** SHA-256 over the canonical action JSON (standard Node crypto — not custom). */
export function hashPassportAction(canonical: PassportCanonicalAction): string {
  const material = JSON.stringify({
    organizationId: canonical.organizationId,
    builderAgentId: canonical.builderAgentId,
    gatewayAgentId: canonical.gatewayAgentId,
    agentRunId: canonical.agentRunId,
    missionGoal: canonical.missionGoal,
    authorizationContext: canonical.authorizationContext,
    tool: canonical.tool,
    action: canonical.action,
    parameters: canonical.parameters,
  });

  return createHash("sha256").update(material, "utf8").digest("hex");
}

export function computePassportActionHash(params: ActionHashInput): {
  canonical: PassportCanonicalAction;
  actionHash: string;
  sanitizedParameters: Record<string, unknown>;
} {
  const canonical = canonicalizePassportAction(params);
  return {
    canonical,
    actionHash: hashPassportAction(canonical),
    sanitizedParameters: canonical.parameters,
  };
}
