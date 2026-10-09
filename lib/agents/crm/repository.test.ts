import assert from "node:assert/strict";
import test from "node:test";
import { isMissingCrmTableError } from "./repository";

test("isMissingCrmTableError matches schema cache message", () => {
  assert.equal(
    isMissingCrmTableError(
      "Could not find the table 'public.agent_crm_updates' in the schema cache"
    ),
    true
  );
});

test("isMissingCrmTableError ignores unrelated errors", () => {
  assert.equal(isMissingCrmTableError("duplicate key value"), false);
});
