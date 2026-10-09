import { formatTime12 } from "./time-input";
import { normalizeAgentTimezone } from "./timezone";

function timezoneShortLabel(timezone: string): string {
  const tz = normalizeAgentTimezone(timezone);
  if (tz === "Asia/Kolkata") return "IST";
  try {
    const part = new Intl.DateTimeFormat("en-IN", {
      timeZone: tz,
      timeZoneName: "short",
    })
      .formatToParts(new Date())
      .find((item) => item.type === "timeZoneName");
    return part?.value ?? tz;
  } catch {
    return tz;
  }
}

export function formatNextRunAt(
  nextRunAt: string | null | undefined,
  timezone: string
): string | null {
  if (!nextRunAt) return null;

  const tz = normalizeAgentTimezone(timezone);
  const tzLabel = timezoneShortLabel(timezone);
  const date = new Date(nextRunAt);

  try {
    const dateLabel = new Intl.DateTimeFormat("en-IN", {
      timeZone: tz,
      dateStyle: "medium",
    }).format(date);

    const timeParts = new Intl.DateTimeFormat("en-IN", {
      timeZone: tz,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).formatToParts(date);

    const hour = timeParts.find((part) => part.type === "hour")?.value ?? "";
    const minute = timeParts.find((part) => part.type === "minute")?.value ?? "";
    const dayPeriod =
      timeParts.find((part) => part.type === "dayPeriod")?.value?.toUpperCase() ??
      "";

    return `${dateLabel}, ${hour}:${minute} ${dayPeriod} ${tzLabel}`;
  } catch {
    return `${date.toISOString()} (${tzLabel})`;
  }
}

export function formatScheduleTimeLabel(
  time24: string | undefined | null,
  timezone: string
): string {
  return `${formatTime12(time24)} ${timezoneShortLabel(timezone)}`;
}

export function scheduleSummaryWithNextRun(params: {
  scheduleSummary?: string | null;
  nextRunAt: string | null;
  timezone: string;
}): string | null {
  const formatted = formatNextRunAt(params.nextRunAt, params.timezone);
  if (!formatted) return params.scheduleSummary ?? null;

  const base = params.scheduleSummary?.trim();
  if (base) {
    return `${base} · Next run: ${formatted}`;
  }
  return `Next run: ${formatted}`;
}
