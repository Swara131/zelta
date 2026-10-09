import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ScheduleValidationError,
  validateAndComputeNextRun,
} from "./validate-schedule";

describe("validateAndComputeNextRun", () => {
  it("computes a future run for daily schedule in IST", () => {
    const from = new Date("2026-09-17T12:00:00.000Z"); // 17:30 IST
    const next = validateAndComputeNextRun({
      frequency: "daily",
      schedule: { when: "daily", time: "18:00" },
      timezone: "Asia/Kolkata",
      from,
    });
    assert.equal(next, "2026-09-17T12:30:00.000Z");
  });

  it("rejects times less than one minute away", () => {
    const from = new Date("2026-09-17T12:29:30.000Z");
    assert.throws(
      () =>
        validateAndComputeNextRun({
          frequency: "daily",
          schedule: { when: "daily", time: "18:00" },
          timezone: "Asia/Kolkata",
          from,
        }),
      ScheduleValidationError
    );
  });
});
