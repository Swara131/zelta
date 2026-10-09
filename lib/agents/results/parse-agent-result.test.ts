import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseAgentResult,
  repairMarkdownTables,
  tableToCsv,
} from "./parse-agent-result";

describe("parseAgentResult", () => {
  it("repairs pipe tables that are missing a separator row", () => {
    const raw = `| Platform | Post # | Draft Copy |
| LinkedIn | 1 | Hello world |`;
    const repaired = repairMarkdownTables(raw);
    assert.match(repaired, /\| --- \| --- \| --- \|/);
    const parsed = parseAgentResult(raw);
    assert.equal(parsed.tables.length, 1);
    assert.equal(parsed.tables[0]?.columns[0], "Platform");
    assert.equal(parsed.tables[0]?.rows[0]?.[0], "LinkedIn");
  });

  it("extracts sources and keeps them out of the body", () => {
    const parsed = parseAgentResult(`## Summary
Useful research.

Sources:
- [OpenAI](https://openai.com/blog)
- https://example.com/news`);
    assert.equal(parsed.sources.length, 2);
    assert.equal(parsed.sources[0]?.title, "OpenAI");
    assert.equal(parsed.sources[0]?.url, "https://openai.com/blog");
    assert.doesNotMatch(parsed.markdown, /openai.com/);
  });

  it("renders structured JSON sections as markdown tables", () => {
    const parsed = parseAgentResult({
      title: "Social Media Content Plan",
      summary: "Promote the whitepaper.",
      sections: [
        {
          title: "Publishing Schedule",
          type: "table",
          columns: ["Date", "Platform", "Time"],
          rows: [["Oct 10", "LinkedIn", "09:00"]],
        },
      ],
      sources: [{ title: "Blog", url: "https://example.com/a" }],
    });
    assert.equal(parsed.kind, "structured");
    assert.match(parsed.markdown, /Publishing Schedule/);
    assert.equal(parsed.tables.length, 1);
    assert.equal(parsed.sources[0]?.domain, "example.com");
  });

  it("hides raw tool JSON dumps", () => {
    const parsed = parseAgentResult({ results: [{ title: "x" }], query: "ai news" });
    assert.match(parsed.markdown, /not a readable report/i);
    assert.ok(parsed.rawJson);
  });

  it("classifies decision payloads", () => {
    const parsed = parseAgentResult({
      decision: "Allowed",
      risk: "Medium",
      reason: "Under the approval threshold.",
      amount: "₹4,500",
      action: "Refund customer",
    });
    assert.equal(parsed.kind, "decision");
    assert.equal(parsed.decision?.status, "Allowed");
  });

  it("does not invent sources from body copy", () => {
    const parsed = parseAgentResult("Visit our site sometime. No sources section.");
    assert.equal(parsed.sources.length, 0);
  });

  it("exports tables as CSV", () => {
    const csv = tableToCsv({
      columns: ["A", "B"],
      rows: [["1", 'say "hi"']],
    });
    assert.equal(csv.split("\n")[1], `"1","say ""hi"""`);
  });

  it("turns a standalone bold line into a heading", () => {
    const parsed = parseAgentResult("**Social Media Drafts & Publishing Schedule**\n\nHello");
    assert.match(parsed.markdown, /^## Social Media Drafts/m);
    assert.doesNotMatch(parsed.markdown, /\*\*Social Media/);
  });
});
