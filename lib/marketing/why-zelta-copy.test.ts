import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatComparisonWinner,
  WHY_ZELTA_COMPARISON_ROWS,
} from "./why-zelta-copy";

describe("why-zelta-copy", () => {
  it("includes the core comparison rows", () => {
    const features = WHY_ZELTA_COMPARISON_ROWS.map((row) => row.feature);
    assert.ok(features.includes("Setup time"));
    assert.ok(features.includes("Learning loop"));
    assert.ok(features.includes("India pricing"));
  });

  it("formats winner labels", () => {
    assert.equal(formatComparisonWinner("zelta"), "⭐ Wave");
    assert.equal(formatComparisonWinner("tie"), "🤝 Tie");
  });
});
