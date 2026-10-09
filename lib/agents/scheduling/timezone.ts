const TIMEZONE_ALIASES: Record<string, string> = {
  IST: "Asia/Kolkata",
  GMT: "UTC",
  UTC: "UTC",
  EST: "America/New_York",
  EDT: "America/New_York",
  PST: "America/Los_Angeles",
  PDT: "America/Los_Angeles",
  CST: "America/Chicago",
  CDT: "America/Chicago",
};

/** Normalize user-facing timezone labels to IANA IDs understood by Intl. */
export function normalizeAgentTimezone(timezone: string | undefined | null): string {
  const trimmed = timezone?.trim();
  if (!trimmed) return "UTC";

  const alias = TIMEZONE_ALIASES[trimmed.toUpperCase()];
  if (alias) return alias;

  try {
    Intl.DateTimeFormat(undefined, { timeZone: trimmed });
    return trimmed;
  } catch {
    console.warn(`[scheduler] Unknown timezone "${trimmed}", falling back to UTC.`);
    return "UTC";
  }
}
