export type Meridiem = "AM" | "PM";

export interface ScheduleTimeParts {
  hour12: number;
  minute: number;
  meridiem: Meridiem;
}

/** Parse HH:MM (24-hour) into parts. Falls back to 9:00 AM on invalid input. */
export function splitTime24(time24: string | undefined | null): ScheduleTimeParts {
  const trimmed = time24?.trim() ?? "";
  const match = /^(\d{1,2}):(\d{2})$/.exec(trimmed);
  if (!match) {
    return { hour12: 9, minute: 0, meridiem: "AM" };
  }

  const hour24 = Number(match[1]);
  const minute = Number(match[2]);
  if (
    !Number.isFinite(hour24) ||
    !Number.isFinite(minute) ||
    hour24 > 23 ||
    minute > 59
  ) {
    return { hour12: 9, minute: 0, meridiem: "AM" };
  }

  const meridiem: Meridiem = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return { hour12, minute, meridiem };
}

/** Build HH:MM (24-hour) from 12-hour clock parts. */
export function buildTime24(parts: ScheduleTimeParts): string {
  const hour12 = Math.min(12, Math.max(1, parts.hour12));
  const minute = Math.min(59, Math.max(0, parts.minute));

  let hour24: number;
  if (parts.meridiem === "AM") {
    hour24 = hour12 === 12 ? 0 : hour12;
  } else {
    hour24 = hour12 === 12 ? 12 : hour12 + 12;
  }

  return `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** Display label such as "6:19 PM". */
export function formatTime12(time24: string | undefined | null): string {
  const { hour12, minute, meridiem } = splitTime24(time24);
  return `${hour12}:${String(minute).padStart(2, "0")} ${meridiem}`;
}

/** Normalize any HH:MM string to zero-padded 24-hour form, or null if invalid. */
export function normalizeTime24(time24: string | undefined | null): string | null {
  const parts = splitTime24(time24);
  const rebuilt = buildTime24(parts);
  const match = /^(\d{2}):(\d{2})$/.exec(rebuilt);
  if (!match) return null;
  return rebuilt;
}
