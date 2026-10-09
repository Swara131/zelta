import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildUnsureAgentProfile,
  canProceedFromCapabilities,
  canProceedFromDescribe,
} from "./unsure-agent-profile";

describe("unsure-agent-profile", () => {
  it("builds a customer support summary from capabilities", () => {
    const profile = buildUnsureAgentProfile({
      description: "It answers customer questions and sends emails.",
      capabilities: [
        "answer_questions",
        "access_customer_info",
        "process_refunds",
      ],
    });

    assert.equal(profile.title, "Customer Support Agent");
    assert.match(profile.summary, /answers customer questions/i);
    assert.match(profile.summary, /accesses customer information/i);
    assert.match(profile.summary, /handles refunds/i);
  });

  it("requires meaningful description or capabilities to continue", () => {
    assert.equal(canProceedFromDescribe("Hi"), false);
    assert.equal(canProceedFromDescribe("It answers customer questions."), true);
    assert.equal(
      canProceedFromCapabilities("", ["send_emails"]),
      true
    );
  });

  it("does not imply a connection in the profile output", () => {
    const profile = buildUnsureAgentProfile({
      description: "",
      capabilities: ["answer_questions"],
    });

    assert.ok(!profile.summary.toLowerCase().includes("connected"));
    assert.ok(!profile.title.toLowerCase().includes("connected"));
  });
});
