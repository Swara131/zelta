import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ADVANCED_NAV, PRIMARY_NAV } from "@/lib/navigation/app-nav";
import { CTA } from "@/lib/ux/cta-labels";

describe("app navigation", () => {
  it("includes the nine primary founder routes", () => {
    const labels = PRIMARY_NAV.map((item) => item.label);
    assert.deepEqual(labels, [
      "Overview",
      "My Agents",
      "Protection",
      "Approvals",
      "Activity",
      "Insights",
      "Billing",
      "Developers",
      "Settings",
    ]);
  });

  it("does not duplicate developers or settings in advanced nav", () => {
    const advancedHrefs = ADVANCED_NAV.map((item) => item.href);
    assert.ok(!advancedHrefs.includes("/developers"));
    assert.ok(!advancedHrefs.includes("/settings"));
  });
});

describe("cta labels", () => {
  it("uses title case for shared actions", () => {
    assert.equal(CTA.createAgent, "Create Agent");
    assert.equal(CTA.connectExistingAgent, "Connect Existing Agent");
    assert.equal(CTA.viewActivity, "View Activity");
  });
});
