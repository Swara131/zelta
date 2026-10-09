import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import MarkdownDocument from "../../../components/agents/results/MarkdownDocument";

describe("MarkdownDocument", () => {
  it("renders headings, tables, and bold instead of raw syntax", () => {
    const html = renderToStaticMarkup(
      createElement(MarkdownDocument, {
        markdown: `**Social Media Drafts & Publishing Schedule**

### Draft Posts

| Platform | Post # | Draft Copy |
| --- | --- | --- |
| LinkedIn | 1 | Hello world |

[Example](https://example.com)
`,
      })
    );

    assert.match(html, /<h3>/);
    assert.match(html, /<table>/);
    assert.match(html, /<th>/);
    assert.match(html, /LinkedIn/);
    assert.doesNotMatch(html, /\*\*Social Media/);
    assert.doesNotMatch(html, /\| Platform \|/);
    assert.match(html, /href="https:\/\/example.com"/);
    assert.doesNotMatch(html, /javascript:/);
  });

  it("does not turn javascript URLs into links", () => {
    const html = renderToStaticMarkup(
      createElement(MarkdownDocument, {
        markdown: "[x](javascript:alert(1))",
      })
    );
    assert.doesNotMatch(html, /javascript:/);
  });
});
