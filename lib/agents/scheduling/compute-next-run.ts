import type { AgentScheduleConfig, AgentScheduleFrequency } from "../runtime-types";
import { normalizeAgentTimezone } from "./timezone";

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: string;
}

const WEEKDAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

function parseTime(time: string): { hour: number; minute: number } {
  const [hourPart, minutePart] = time.split(":");
  const hour = Number(hourPart);
  const minute = Number(minutePart);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return { hour: 9, minute: 0 };
  }
  return { hour, minute };
}

function getZonedParts(date: Date, timezone: string): ZonedParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "long",
  });

  const parts = formatter.formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    weekday: (
      parts.find((part) => part.type === "weekday")?.value ?? "monday"
    ).toLowerCase(),
  };
}

function getTimezoneOffsetMs(utcDate: Date, timezone: string): number {
  const parts = getZonedParts(utcDate, timezone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    0,
    0
  );
  return asUtc - utcDate.getTime();
}

function zonedLocalToUtc(
  local: { year: number; month: number; day: number; hour: number; minute: number },
  timezone: string
): Date {
  const guess = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute);
  const offset = getTimezoneOffsetMs(new Date(guess), timezone);
  return new Date(guess - offset);
}

function scheduleWhen(config: AgentScheduleConfig): AgentScheduleConfig["when"] {
  return config.when ?? "manual";
}

function isWeeklyMatch(config: AgentScheduleConfig, weekday: string): boolean {
  const days = config.days?.map((day) => day.toLowerCase()) ?? ["monday"];
  return days.includes(weekday.toLowerCase());
}

export function computeNextRunAt(
  frequency: AgentScheduleFrequency,
  scheduleConfig: AgentScheduleConfig,
  timezone: string,
  from = new Date()
): string | null {
  const tz = normalizeAgentTimezone(timezone);
  const when = scheduleWhen(scheduleConfig);

  if (frequency === "manual" || when === "manual") return null;
  if (when === "on_event") return null;

  const { hour: targetHour, minute: targetMinute } = parseTime(
    scheduleConfig.time ?? "09:00"
  );

  for (let dayOffset = 0; dayOffset <= 370; dayOffset += 1) {
    const probe = new Date(from.getTime() + dayOffset * 86_400_000);
    const parts = getZonedParts(probe, tz);

    if (frequency === "weekly" || when === "weekly") {
      if (!isWeeklyMatch(scheduleConfig, parts.weekday)) continue;
    }

    const candidate = zonedLocalToUtc(
      {
        year: parts.year,
        month: parts.month,
        day: parts.day,
        hour: targetHour,
        minute: targetMinute,
      },
      tz
    );

    if (candidate.getTime() > from.getTime()) {
      return candidate.toISOString();
    }
  }

  return null;
}

export function deriveScheduleStatus(
  frequency: AgentScheduleFrequency,
  scheduleConfig: AgentScheduleConfig,
  enabled: boolean
): "idle" | "scheduled" | "waiting" {
  if (!enabled || frequency === "manual" || scheduleConfig.when === "manual") {
    return "idle";
  }
  if (scheduleConfig.when === "on_event") {
    return "waiting";
  }
  return "scheduled";
}

export function weekdayFromDate(date: Date, timezone: string): string {
  return getZonedParts(date, timezone).weekday;
}

export function listWeekdays(): string[] {
  return WEEKDAY_NAMES.slice(1).concat(WEEKDAY_NAMES[0]!);
}
