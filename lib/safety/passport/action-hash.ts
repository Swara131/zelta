import { timingSafeEqual } from "crypto";
import type { SafetyDecision } from "@/lib/safety/types";
import {
  computePassportActionHash,
  type ActionHashInput,
  type PassportCanonicalAction,
} from "./canonicalize";

export type { ActionHashInput, PassportCanonicalAction };

export interface ActionHashResult {
  canonical: PassportCanonicalAction;
  actionHash: string;
  sanitizedParameters: Record<string, unknown>;
}

function hashLogContext(input: ActionHashInput): Record<string, unknown> {
  return {
    builderAgentId: input.builderAgentId,
    agentRunId: input.agentRunId,
    tool: input.tool,
    action: input.action,
    missionGoalPresent: Boolean(input.missionGoal?.trim()),
  };
}

/** Generates a SHA-256 fingerprint of the canonical action representation. */
export function generateActionHash(input: ActionHashInput): ActionHashResult {
  const result = computePassportActionHash(input);

  console.info("[safety][hash] generated", {
    ...hashLogContext(input),
    actionHashPrefix: result.actionHash.slice(0, 12),
  });

  return result;
}

function compareHashes(expected: string, actual: string): boolean {
  if (expected.length !== actual.length) {
    return false;
  }

  try {
    return timingSafeEqual(
      Buffer.from(expected, "utf8"),
      Buffer.from(actual, "utf8")
    );
  } catch {
    return false;
  }
}

export interface ActionHashVerification {
  match: boolean;
  actionHash: string;
  canonical: PassportCanonicalAction;
}

/**
 * Recomputes the action hash from the actual execution request and compares
 * it to the authorized hash using a timing-safe comparison.
 */
export function verifyActionHash(
  authorizedHash: string,
  input: ActionHashInput
): ActionHashVerification {
  const { actionHash, canonical } = computePassportActionHash(input);
  const match = compareHashes(authorizedHash, actionHash);

  if (match) {
    console.info("[safety][hash] verified", {
      ...hashLogContext(input),
      actionHashPrefix: actionHash.slice(0, 12),
    });
  } else {
    console.info("[safety][hash] mismatch", {
      ...hashLogContext(input),
      authorizedHashPrefix: authorizedHash.slice(0, 12),
      actualHashPrefix: actionHash.slice(0, 12),
    });
  }

  return { match, actionHash, canonical };
}

/** @internal Test helper for timing-safe hash comparison. */
export function compareActionHashes(expected: string, actual: string): boolean {
  return compareHashes(expected, actual);
}

export function normalizeSafetyDecisionForHash(
  decision?: SafetyDecision
): SafetyDecision {
  return decision ?? "ALLOW";
}
