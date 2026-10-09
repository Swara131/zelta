import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ACTION_HASH_MISMATCH_MESSAGE,
  ACTION_PASSPORT_TTL_SECONDS,
  PASSPORT_MISMATCH_MESSAGE,
} from "./constants";
import { generateActionHash, verifyActionHash } from "./action-hash";
import { computePassportActionHash } from "./canonicalize";
import { createMemoryActionPassportStore } from "./memory-store";
import { createSupabaseActionPassportStore } from "./repository";
import type {
  ActionPassportCreated,
  ActionPassportStore,
  ActionPassportVerification,
  CreateActionPassportInput,
  VerifyActionPassportInput,
} from "./types";

let testStoreOverride: ActionPassportStore | null = null;
let memoryFallbackStore: ActionPassportStore | null = null;
let warnedMissingTable = false;

/** Test hook — swaps passport persistence for in-memory store. */
export function setActionPassportStoreForTests(store: ActionPassportStore | null): void {
  testStoreOverride = store;
}

function isMissingPassportTableError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /action_passports/i.test(message) && /schema cache|does not exist|could not find the table/i.test(message);
}

function createResilientPassportStore(supabase: SupabaseClient): ActionPassportStore {
  const db = createSupabaseActionPassportStore(supabase);

  async function withStore<T>(
    operation: (store: ActionPassportStore) => Promise<T>
  ): Promise<T> {
    if (memoryFallbackStore) {
      return operation(memoryFallbackStore);
    }
    try {
      return await operation(db);
    } catch (err) {
      if (!isMissingPassportTableError(err)) throw err;
      if (!warnedMissingTable) {
        warnedMissingTable = true;
        console.warn(
          "[safety][passport] public.action_passports is missing. Apply supabase/migrations/20260922103000_action_passports.sql. Using an in-process passport store until then."
        );
      }
      memoryFallbackStore = createMemoryActionPassportStore();
      return operation(memoryFallbackStore);
    }
  }

  return {
    insert: (record) => withStore((store) => store.insert(record)),
    findById: (id) => withStore((store) => store.findById(id)),
    findByProposalId: (proposalId) => withStore((store) => store.findByProposalId(proposalId)),
    consumeAtomically: (params) => withStore((store) => store.consumeAtomically(params)),
    revoke: (passportId, revokedAt) => withStore((store) => store.revoke(passportId, revokedAt)),
  };
}

function getStore(supabase?: SupabaseClient): ActionPassportStore {
  if (testStoreOverride) {
    return testStoreOverride;
  }
  return createResilientPassportStore(supabase ?? createAdminClient());
}

function logPassport(
  phase: "created" | "verified" | "consumed" | "revoked" | "blocked",
  params: Record<string, unknown>
): void {
  console.info(`[safety][passport] ${phase}`, params);
}

function hashInputFromVerify(
  input: VerifyActionPassportInput,
  passport: NonNullable<ActionPassportVerification["passport"]>
) {
  return {
    organizationId: input.organizationId,
    builderAgentId: input.builderAgentId,
    gatewayAgentId: input.gatewayAgentId,
    agentRunId: input.agentRunId,
    missionGoal: input.missionGoal ?? passport.missionGoal,
    safetyDecision: input.safetyDecision ?? passport.safetyDecision,
    tool: input.tool,
    action: input.action,
    parameters: input.parameters,
  };
}

export async function createActionPassport(
  input: CreateActionPassportInput,
  supabase?: SupabaseClient
): Promise<ActionPassportCreated> {
  if (input.safetyDecision !== "ALLOW" && input.status !== "pending_approval") {
    throw new Error("Action passports are only issued for ALLOW decisions.");
  }
  if (input.status === "pending_approval" && input.safetyDecision !== "REQUIRE_APPROVAL") {
    throw new Error("Pending approval passports require REQUIRE_APPROVAL.");
  }

  const { actionHash, sanitizedParameters } = generateActionHash({
    organizationId: input.organizationId,
    builderAgentId: input.builderAgentId,
    gatewayAgentId: input.gatewayAgentId,
    agentRunId: input.agentRunId,
    missionGoal: input.missionGoal ?? null,
    safetyDecision: input.safetyDecision,
    tool: input.tool,
    action: input.action,
    parameters: input.parameters,
  });

  const passportId = randomUUID();
  const expiresAt = new Date(
    Date.now() + ACTION_PASSPORT_TTL_SECONDS * 1000
  ).toISOString();

  const store = getStore(supabase);
  await store.insert({
    id: passportId,
    organizationId: input.organizationId,
    builderAgentId: input.builderAgentId,
    gatewayAgentId: input.gatewayAgentId,
    agentRunId: input.agentRunId,
    agentActionId: input.agentActionId ?? null,
    actionProposalId: input.actionProposalId ?? null,
    toolName: input.tool,
    actionType: input.action,
    actionHash,
    parametersSnapshot: sanitizedParameters,
    missionGoal: input.missionGoal ?? null,
    safetyDecision: input.safetyDecision,
    status: input.status ?? "active",
    expiresAt: input.expiresAt ?? expiresAt,
    usedAt: null,
    revokedAt: null,
  });

  logPassport("created", {
    passportId,
    builderAgentId: input.builderAgentId,
    agentRunId: input.agentRunId,
    tool: input.tool,
    action: input.action,
    expiresAt,
  });

  return { passportId, actionHash, expiresAt };
}

/** Binds an exact action awaiting human approval to a pending Action Passport. */
export async function createPendingActionPassport(
  input: CreateActionPassportInput & {
    actionProposalId: string;
    expiresAt: string;
  },
  supabase?: SupabaseClient
): Promise<ActionPassportCreated> {
  if (input.safetyDecision !== "REQUIRE_APPROVAL") {
    throw new Error("Pending passports require a REQUIRE_APPROVAL safety decision.");
  }

  return createActionPassport(
    {
      ...input,
      status: "pending_approval",
      safetyDecision: "REQUIRE_APPROVAL",
    },
    supabase
  );
}

export async function verifyActionPassport(
  input: VerifyActionPassportInput,
  supabase?: SupabaseClient
): Promise<ActionPassportVerification> {
  const store = getStore(supabase);
  const passport = await store.findById(input.passportId);

  if (!passport) {
    logPassport("blocked", { passportId: input.passportId, reason: "not_found" });
    return { valid: false, reason: PASSPORT_MISMATCH_MESSAGE };
  }

  const now = new Date();
  if (passport.status === "used") {
    logPassport("blocked", { passportId: input.passportId, reason: "already_used" });
    return { valid: false, reason: PASSPORT_MISMATCH_MESSAGE, passport };
  }

  if (passport.status === "revoked") {
    logPassport("blocked", { passportId: input.passportId, reason: "revoked" });
    return { valid: false, reason: PASSPORT_MISMATCH_MESSAGE, passport };
  }

  if (new Date(passport.expiresAt) <= now) {
    logPassport("blocked", { passportId: input.passportId, reason: "expired" });
    return { valid: false, reason: PASSPORT_MISMATCH_MESSAGE, passport };
  }

  const hashVerification = verifyActionHash(
    passport.actionHash,
    hashInputFromVerify(input, passport)
  );

  if (!hashVerification.match) {
    logPassport("blocked", { passportId: input.passportId, reason: "hash_mismatch" });
    return { valid: false, reason: ACTION_HASH_MISMATCH_MESSAGE, passport };
  }

  logPassport("verified", {
    passportId: input.passportId,
    builderAgentId: input.builderAgentId,
    agentRunId: input.agentRunId,
    tool: input.tool,
    action: input.action,
  });

  return { valid: true, reason: "Action passport verified.", passport };
}

export async function consumeActionPassport(
  params: VerifyActionPassportInput & {
    allowedStatuses?: Array<"active" | "pending_approval">;
  },
  supabase?: SupabaseClient
): Promise<ActionPassportVerification> {
  const verification = await verifyActionPassport(params, supabase);
  if (!verification.valid || !verification.passport) {
    return verification;
  }

  const { actionHash } = computePassportActionHash(
    hashInputFromVerify(params, verification.passport)
  );

  const usedAt = new Date().toISOString();
  const store = getStore(supabase);
  const consumed = await store.consumeAtomically({
    passportId: params.passportId,
    actionHash,
    usedAt,
    allowedStatuses: params.allowedStatuses ?? ["active"],
  });

  if (!consumed) {
    logPassport("blocked", { passportId: params.passportId, reason: "consume_failed" });
    return { valid: false, reason: PASSPORT_MISMATCH_MESSAGE };
  }

  logPassport("consumed", {
    passportId: params.passportId,
    builderAgentId: params.builderAgentId,
    agentRunId: params.agentRunId,
    tool: params.tool,
  });

  return { valid: true, reason: "Action passport consumed.", passport: consumed };
}

export async function revokeActionPassport(
  passportId: string,
  supabase?: SupabaseClient
): Promise<boolean> {
  const store = getStore(supabase);
  const revoked = await store.revoke(passportId, new Date().toISOString());
  if (revoked) {
    logPassport("revoked", { passportId });
    return true;
  }
  return false;
}
