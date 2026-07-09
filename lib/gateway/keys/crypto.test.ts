import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractKeyPrefix,
  generateAgentApiKeyMaterial,
  hashAgentApiKey,
  isPlausibleAgentApiKey,
  verifyAgentApiKey,
} from "./crypto";

describe("agent API key crypto", () => {
  it("generates keys with brand prefix and distinct hash", () => {
    const first = generateAgentApiKeyMaterial();
    const second = generateAgentApiKeyMaterial();

    assert.match(first.plainKey, /^al_[a-f0-9]{8}_/);
    assert.equal(first.keyPrefix, extractKeyPrefix(first.plainKey));
    assert.notEqual(first.plainKey, second.plainKey);
    assert.notEqual(first.keyHash, second.keyHash);
    assert.equal(first.keyHash, hashAgentApiKey(first.plainKey));
  });

  it("verifies valid keys with constant-time hash compare", () => {
    const material = generateAgentApiKeyMaterial();
    assert.equal(verifyAgentApiKey(material.plainKey, material.keyHash), true);
    assert.equal(
      verifyAgentApiKey(`${material.plainKey}x`, material.keyHash),
      false
    );
  });

  it("rejects implausible key shapes", () => {
    assert.equal(isPlausibleAgentApiKey("short"), false);
    assert.equal(isPlausibleAgentApiKey("sk_live_not_agent_key"), false);
    const material = generateAgentApiKeyMaterial();
    assert.equal(isPlausibleAgentApiKey(material.plainKey), true);
  });
});
