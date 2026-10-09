"use client";

import {
  buildTime24,
  formatTime12,
  splitTime24,
  type Meridiem,
} from "@/lib/agents/scheduling/time-input";
import { normalizeAgentTimezone } from "@/lib/agents/scheduling/timezone";

interface ScheduleTimePickerProps {
  value24: string;
  onChange24: (value24: string) => void;
  timezone?: string;
  disabled?: boolean;
}

function timezoneShortLabel(timezone: string | undefined): string {
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

export function ScheduleTimePicker({
  value24,
  onChange24,
  timezone,
  disabled = false,
}: ScheduleTimePickerProps) {
  const parts = splitTime24(value24);
  const tzLabel = timezoneShortLabel(timezone);

  const update = (patch: Partial<typeof parts>) => {
    onChange24(buildTime24({ ...parts, ...patch }));
  };

  return (
    <div className="zagent-schedule-time">
      <div className="zagent-schedule-time-row">
        <label className="zagent-schedule-time-part">
          <span className="zagent-schedule-time-part-label">Hour</span>
          <select
            className="ds-input"
            value={parts.hour12}
            disabled={disabled}
            onChange={(event) =>
              update({ hour12: Number(event.target.value) })
            }
          >
            {Array.from({ length: 12 }, (_, index) => index + 1).map((hour) => (
              <option key={hour} value={hour}>
                {hour}
              </option>
            ))}
          </select>
        </label>
        <span className="zagent-schedule-time-sep" aria-hidden="true">
          :
        </span>
        <label className="zagent-schedule-time-part">
          <span className="zagent-schedule-time-part-label">Minute</span>
          <select
            className="ds-input"
            value={parts.minute}
            disabled={disabled}
            onChange={(event) =>
              update({ minute: Number(event.target.value) })
            }
          >
            {Array.from({ length: 60 }, (_, minute) => minute).map((minute) => (
              <option key={minute} value={minute}>
                {String(minute).padStart(2, "0")}
              </option>
            ))}
          </select>
        </label>
        <label className="zagent-schedule-time-part">
          <span className="zagent-schedule-time-part-label">AM/PM</span>
          <select
            className="ds-input"
            value={parts.meridiem}
            disabled={disabled}
            onChange={(event) =>
              update({ meridiem: event.target.value as Meridiem })
            }
          >
            <option value="AM">AM</option>
            <option value="PM">PM</option>
          </select>
        </label>
      </div>
      <p className="zagent-hint">
        Selected: <strong>{formatTime12(value24)}</strong> ({tzLabel}) · saved as{" "}
        <strong>{value24}</strong> 24-hour
      </p>
    </div>
  );
}
