import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildTime24, formatTime12, splitTime24 } from "./time-input";

describe("time-input", () => {
  it("builds 06:19 for 6:19 AM", () => {
    assert.equal(
      buildTime24({ hour12: 6, minute: 19, meridiem: "AM" }),
      "06:19"
    );
  });

  it("builds 18:19 for 6:19 PM", () => {
    assert.equal(
      buildTime24({ hour12: 6, minute: 19, meridiem: "PM" }),
      "18:19"
    );
  });

  it("builds 00:00 for 12:00 AM", () => {
    assert.equal(
      buildTime24({ hour12: 12, minute: 0, meridiem: "AM" }),
      "00:00"
    );
  });

  it("builds 12:00 for 12:00 PM", () => {
    assert.equal(
      buildTime24({ hour12: 12, minute: 0, meridiem: "PM" }),
      "12:00"
    );
  });

  it("round-trips 18:19 through split and build", () => {
    const parts = splitTime24("18:19");
    assert.equal(parts.hour12, 6);
    assert.equal(parts.minute, 19);
    assert.equal(parts.meridiem, "PM");
    assert.equal(buildTime24(parts), "18:19");
  });

  it("formats 18:19 as 6:19 PM", () => {
    assert.equal(formatTime12("18:19"), "6:19 PM");
  });

  it("formats 06:19 as 6:19 AM", () => {
    assert.equal(formatTime12("06:19"), "6:19 AM");
  });
});
