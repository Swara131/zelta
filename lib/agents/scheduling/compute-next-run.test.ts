import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeNextRunAt,
  deriveScheduleStatus,
} from "./compute-next-run";

describe("computeNextRunAt", () => {
  it("returns null for manual schedules", () => {
    assert.equal(
      computeNextRunAt("manual", { when: "manual" }, "UTC", new Date("2026-09-15T10:00:00Z")),
      null
    );
  });

  it("returns a future timestamp for daily schedules", () => {
    const from = new Date("2026-09-15T10:00:00Z");
    const next = computeNextRunAt(
      "daily",
      { when: "daily", time: "09:00" },
      "UTC",
      from
    );
    assert.ok(next);
    assert.ok(new Date(next!).getTime() > from.getTime());
  });

  it("computes 10:30 IST as 05:00 UTC the same day", () => {
    const from = new Date("2026-09-16T04:00:00.000Z");
    const next = computeNextRunAt(
      "daily",
      { when: "daily", time: "10:30" },
      "IST",
      from
    );
    assert.equal(next, "2026-09-16T05:00:00.000Z");
  });

  it("marks event-driven schedules as waiting", () => {
    assert.equal(
      deriveScheduleStatus("custom", { when: "on_event" }, true),
      "waiting"
    );
  });
});
