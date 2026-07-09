import { createHash } from "crypto";

export interface CanonicalActionInput {
  organizationId: string;
  agentId: string;
  toolName: string;
  actionType: string;
  payload: unknown;
}

export interface CanonicalAction {
  organizationId: string;
  agentId: string;
  toolName: string;
  actionType: string;
  payload: unknown;
}

/** Deep-sorts object keys and normalizes nested structures for stable hashing. */
export function normalizePayload(value: unknown): unknown {
  if (value === null || value === undefined) {
    return null;
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizePayload(item));
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const normalized: Record<string, unknown> = {};

    for (const key of Object.keys(record).sort()) {
      normalized[key] = normalizePayload(record[key]);
    }

    return normalized;
  }

  if (typeof value === "string") {
    return value;
  }

  return value;
}

export function canonicalizeAction(input: CanonicalActionInput): CanonicalAction {
  return {
    organizationId: input.organizationId.trim(),
    agentId: input.agentId.trim(),
    toolName: input.toolName.trim(),
    actionType: input.actionType.trim(),
    payload: normalizePayload(input.payload ?? {}),
  };
}

/** Stable SHA-256 over org, agent, tool, action type, and normalized payload. */
export function hashCanonicalAction(canonical: CanonicalAction): string {
  const material = JSON.stringify({
    organizationId: canonical.organizationId,
    agentId: canonical.agentId,
    toolName: canonical.toolName,
    actionType: canonical.actionType,
    payload: canonical.payload,
  });

  return createHash("sha256").update(material, "utf8").digest("hex");
}

export function computeActionHash(input: CanonicalActionInput): string {
  return hashCanonicalAction(canonicalizeAction(input));
}
