import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { inferDeliveryModeFromText } from "./infer-delivery";

describe("inferDeliveryModeFromText", () => {
  it("infers email only when the user asks for email", () => {
    assert.equal(
      inferDeliveryModeFromText(
        "Create an agent that finds new AI news every morning and email me a short summary."
      ),
      "email"
    );
  });

  it("infers notification for notify me", () => {
    assert.equal(
      inferDeliveryModeFromText("Notify me when there is a critical approval."),
      "notification"
    );
  });

  it("infers email from by email", () => {
    assert.equal(
      inferDeliveryModeFromText(
        "Find the latest AI news every morning and send me a short summary by email."
      ),
      "email"
    );
  });

  it("does not assume email when the channel is unspecified", () => {
    assert.equal(
      inferDeliveryModeFromText("Find AI news every morning and give me a digest."),
      "notification"
    );
  });
});
