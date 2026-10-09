import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderAgentResult } from "./render";

describe("renderAgentResult", () => {
  it("uses Wave subject and includes summary and sources", () => {
    const rendered = renderAgentResult({
      agentName: "AI News",
      agentSlug: "custom-agent-2",
      summary: "Major AI announcements today.",
      sources: ["https://techcrunch.com/example"],
      recipientName: "Alex",
      runMode: "scheduled",
      runAt: "2026-09-16T05:00:00.000Z",
      timezone: "Asia/Kolkata",
    });

    assert.equal(rendered.subject, "Wave Agent Result — AI News");
    assert.match(rendered.html, /Major AI announcements today/);
    assert.match(rendered.html, /techcrunch\.com/);
    assert.match(rendered.html, /Today's summary/i);
  });
});
