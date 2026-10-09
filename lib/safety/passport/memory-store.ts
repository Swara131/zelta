import type {
  ActionPassportRecord,
  ActionPassportStore,
} from "./types";

export function createMemoryActionPassportStore(): ActionPassportStore {
  const records = new Map<string, ActionPassportRecord>();

  return {
    async insert(record) {
      const created: ActionPassportRecord = {
        ...record,
        actionProposalId: record.actionProposalId ?? null,
        createdAt: record.createdAt ?? new Date().toISOString(),
      };
      records.set(created.id, created);
      return created;
    },

    async findById(id) {
      return records.get(id) ?? null;
    },

    async findByProposalId(proposalId) {
      for (const record of records.values()) {
        if (record.actionProposalId === proposalId) {
          return record;
        }
      }
      return null;
    },

    async consumeAtomically(params) {
      const existing = records.get(params.passportId);
      if (!existing) return null;

      const allowed = params.allowedStatuses ?? ["active"];
      if (!allowed.includes(existing.status)) return null;
      if (existing.actionHash !== params.actionHash) return null;
      if (new Date(existing.expiresAt) <= new Date(params.usedAt)) return null;

      const updated: ActionPassportRecord = {
        ...existing,
        status: "used",
        usedAt: params.usedAt,
      };
      records.set(updated.id, updated);
      return updated;
    },

    async revoke(passportId, revokedAt) {
      const existing = records.get(passportId);
      if (
        !existing ||
        (existing.status !== "active" && existing.status !== "pending_approval")
      ) {
        return null;
      }

      const updated: ActionPassportRecord = {
        ...existing,
        status: "revoked",
        revokedAt,
      };
      records.set(updated.id, updated);
      return updated;
    },
  };
}
