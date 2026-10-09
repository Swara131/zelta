import type { AgentScheduleConfig, AgentScheduleFrequency } from "../runtime-types";
import { computeNextRunAt } from "./compute-next-run";
import { normalizeAgentTimezone } from "./timezone";

const MIN_LEAD_MS = 60_000;

export class ScheduleValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScheduleValidationError";
  }
}

export function validateScheduleTimeString(time: string | undefined): void {
  if (!time?.trim()) {
    throw new ScheduleValidationError("Schedule time is required.");
  }

  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) {
    throw new ScheduleValidationError("Schedule time must use HH:MM format.");
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) {
    throw new ScheduleValidationError("Schedule time is invalid.");
  }
}

export function validateAndComputeNextRun(params: {
  frequency: AgentScheduleFrequency;
  schedule: AgentScheduleConfig;
  timezone: string;
  from?: Date;
}): string {
  const tz = normalizeAgentTimezone(params.timezone);
  const when = params.schedule.when ?? "manual";

  if (when === "manual" || when === "on_event") {
    throw new ScheduleValidationError("This schedule type does not support timed runs.");
  }

  validateScheduleTimeString(params.schedule.time);

  const nextRunAt = computeNextRunAt(
    params.frequency,
    params.schedule,
    tz,
    params.from ?? new Date()
  );

  if (!nextRunAt) {
    throw new ScheduleValidationError(
      "Could not compute the next run time. Check the schedule and timezone."
    );
  }

  const reference = params.from ?? new Date();
  const leadMs = new Date(nextRunAt).getTime() - reference.getTime();
  if (leadMs < MIN_LEAD_MS) {
    throw new ScheduleValidationError(
      "Scheduled time must be at least 1 minute in the future. Choose a later time."
    );
  }

  return nextRunAt;
}
