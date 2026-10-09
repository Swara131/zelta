import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AGENT_PLATFORM_OPTIONS,
  BUILD_AGENT_COPY,
  getAgentPlatformOption,
} from "./connect-protect-options";

describe("connect-protect-options", () => {
  it("defines five agent platform choices", () => {
    assert.equal(AGENT_PLATFORM_OPTIONS.length, 5);
  });

  it("allows third-party platforms to continue to setup", () => {
    const other = getAgentPlatformOption("other-platform");
    assert.equal(other?.status, "setup_required");
    assert.equal(other?.ctaHref, "/onboarding/connect/wizard?platform=other-platform");
  });

  it("routes supported paths to the connection wizard", () => {
    const expected: Record<string, string> = {
      zelta: "/onboarding/connect/wizard?platform=zelta",
      langchain: "/onboarding/connect/wizard?platform=langchain",
      custom: "/onboarding/connect/wizard?platform=custom",
    };
    for (const [id, href] of Object.entries(expected)) {
      const option = getAgentPlatformOption(id as "zelta" | "langchain" | "custom");
      assert.equal(option?.status, "setup_required");
      assert.equal(option?.ctaHref, href);
    }
  });

  it("opens the agent builder", () => {
    assert.equal(BUILD_AGENT_COPY.ctaHref, "/agents/build");
  });
});
