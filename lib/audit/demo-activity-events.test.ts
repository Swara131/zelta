import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ACTIVITY_DEMO_DISCLAIMER,
  buildDemoActivityViews,
} from "./demo-activity-events";

describe("demo-activity-events", () => {
  it("builds four realistic demo audit events", () => {
    const events = buildDemoActivityViews();

    assert.equal(events.length, 4);
    assert.match(ACTIVITY_DEMO_DISCLAIMER, /Simulated/i);
    assert.ok(events.every((event) => event.isSimulated));

    const refundWaiting = events.find((event) => event.actionLabel === "Refund ₹25,000");
    assert.ok(refundWaiting);
    assert.equal(refundWaiting.decisionLabel, "Approval Required");
    assert.equal(refundWaiting.statusLabel, "Waiting");
    assert.equal(refundWaiting.proposedAction, "Refund ₹25,000 to customer CUST-1042");

    const blocked = events.find((event) => event.actionLabel === "Refund ₹75,000");
    assert.ok(blocked);
    assert.equal(blocked.decisionLabel, "Blocked");
    assert.equal(blocked.riskLabel, "Critical");
  });
});
