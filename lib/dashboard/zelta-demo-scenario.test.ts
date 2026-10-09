import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ZELTA_DEMO_ACTIONS,
  ZELTA_DEMO_AGENT_NAME,
  ZELTA_DEMO_DISCLAIMER,
  demoDecisionClass,
} from "./zelta-demo-scenario";

describe("zelta-demo-scenario", () => {
  it("uses clearly labeled demo agent and disclaimer", () => {
    assert.match(ZELTA_DEMO_AGENT_NAME, /Agent/);
    assert.match(ZELTA_DEMO_DISCLAIMER, /DEMO DATA/i);
    assert.match(ZELTA_DEMO_DISCLAIMER, /simulated/i);
  });

  it("includes four example actions with allow, ask, and block outcomes", () => {
    assert.equal(ZELTA_DEMO_ACTIONS.length, 4);

    const decisions = ZELTA_DEMO_ACTIONS.map((action) => action.decision);
    assert.ok(decisions.includes("allowed"));
    assert.ok(decisions.includes("approval_required"));
    assert.ok(decisions.includes("blocked"));

    const refund = ZELTA_DEMO_ACTIONS.find((action) =>
      action.label.includes("₹15,000")
    );
    assert.ok(refund);
    assert.equal(refund?.decision, "approval_required");
    assert.equal(refund?.decisionLabel, "Approval required");
  });

  it("maps decisions to presentation classes", () => {
    assert.equal(demoDecisionClass("allowed"), "fd-demo-decision-allow");
    assert.equal(demoDecisionClass("approval_required"), "fd-demo-decision-ask");
    assert.equal(demoDecisionClass("blocked"), "fd-demo-decision-block");
  });
});
