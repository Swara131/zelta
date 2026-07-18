/** Postgres unique violation — concurrent duplicate notification insert. */
export function isNotificationUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const record = error as { code?: string; message?: string };
  if (record.code === "23505") {
    return true;
  }
  return typeof record.message === "string" && record.message.includes("duplicate key");
}
