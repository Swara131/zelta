import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildFallbackAgentSpec } from "@/lib/agent-builder/fallback-spec";
import {
  REFUND_AGENT_PROTECTION,
  protectionFromAgentSpec,
} from "./plain-english";

describe("plain-english protection", () => {
  it("provides the refund agent example", () => {
    assert.ok(
      REFUND_AGENT_PROTECTION.allowed.some((item) => item.label.includes("₹5,000"))
    );
    assert.ok(
      REFUND_AGENT_PROTECTION.askFirst.some((item) => item.label.includes("discount"))
    );
    assert.ok(
      REFUND_AGENT_PROTECTION.blocked.some((item) =>
        item.label.includes("Delete customer")
      )
    );
    assert.ok(
      REFUND_AGENT_PROTECTION.blocked.some((item) =>
        item.label.includes("Disable security")
      )
    );
  });

  it("maps generated refund agent specs to founder-friendly groups", () => {
    const spec = buildFallbackAgentSpec(
      "Email customers their refund status and issue refunds under ₹5,000 automatically."
    );
    const config = protectionFromAgentSpec(spec);

    assert.ok(config.allowed.some((item) => item.label.includes("Send customer email")));
    assert.ok(config.blocked.some((item) => item.label.includes("Delete customer")));
  });
});
