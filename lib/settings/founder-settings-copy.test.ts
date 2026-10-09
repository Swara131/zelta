import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatAccountDate,
  formatOrgRole,
  NOTIFICATION_SETTINGS,
} from "./founder-settings-copy";

describe("founder-settings-copy", () => {
  it("formats org roles for display", () => {
    assert.equal(formatOrgRole("owner"), "Owner");
    assert.equal(formatOrgRole("admin"), "Admin");
    assert.equal(formatOrgRole("member"), "Member");
  });

  it("includes the four notification categories", () => {
    assert.equal(NOTIFICATION_SETTINGS.length, 4);
    assert.ok(NOTIFICATION_SETTINGS.some((item) => item.id === "approvals"));
    assert.ok(NOTIFICATION_SETTINGS.some((item) => item.id === "blocked"));
  });

  it("formats account dates", () => {
    const formatted = formatAccountDate("2026-01-15T12:00:00.000Z");
    assert.match(formatted, /2026/);
    assert.equal(formatAccountDate(null), "—");
  });
});
