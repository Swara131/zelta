import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  EmailBaseUrlError,
  getEmailAppBaseUrl,
  isLocalOrPrivateAppUrl,
} from "./env";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("isLocalOrPrivateAppUrl", () => {
  it("detects localhost and loopback", () => {
    assert.equal(isLocalOrPrivateAppUrl("http://localhost:3000"), true);
    assert.equal(isLocalOrPrivateAppUrl("http://localhost:8000"), true);
    assert.equal(isLocalOrPrivateAppUrl("http://127.0.0.1:3000"), true);
    assert.equal(isLocalOrPrivateAppUrl("https://app.zelta.example"), false);
  });
});

describe("getEmailAppBaseUrl", () => {
  it("returns APP_BASE_URL when set to a public URL", () => {
    process.env.APP_BASE_URL = "https://zelta.example/";
    assert.equal(getEmailAppBaseUrl(), "https://zelta.example");
  });

  it("returns PUBLIC_APP_URL when APP_BASE_URL is unset", () => {
    delete process.env.APP_BASE_URL;
    process.env.PUBLIC_APP_URL = "https://tunnel.trycloudflare.com/";
    assert.equal(getEmailAppBaseUrl(), "https://tunnel.trycloudflare.com");
  });

  it("throws when only localhost is configured", () => {
    process.env.APP_BASE_URL = "http://localhost:8000";
    assert.throws(() => getEmailAppBaseUrl(), EmailBaseUrlError);
  });

  it("throws when no URL is configured", () => {
    delete process.env.APP_BASE_URL;
    delete process.env.APPROVAL_BASE_URL;
    delete process.env.PUBLIC_URL;
    delete process.env.APP_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.RAILWAY_PUBLIC_DOMAIN;
    delete process.env.RAILWAY_STATIC_URL;
    assert.throws(() => getEmailAppBaseUrl(), EmailBaseUrlError);
  });
});
