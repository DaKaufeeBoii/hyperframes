import { describe, expect, it } from "vitest";
import { applyDotEnv } from "./dotEnv.js";

describe("applyDotEnv", () => {
  it("copies a project's keys without overwriting what is already set", () => {
    const env: NodeJS.ProcessEnv = { KEPT: "outer" };
    applyDotEnv('export GEMINI_KEY="abc" # note\nKEPT=inner\n# comment\nPLAIN=x #c', env);
    expect(env).toEqual({ KEPT: "outer", GEMINI_KEY: "abc", PLAIN: "x" });
  });

  it("never takes the feedback email from a project file", () => {
    const env: NodeJS.ProcessEnv = {};
    applyDotEnv("HYPERFRAMES_FEEDBACK_EMAIL=someone@example.com\nOTHER=1", env);
    expect(env).toEqual({ OTHER: "1" });
  });

  it("never takes the feedback email under another letter case", () => {
    const env: NodeJS.ProcessEnv = {};
    applyDotEnv(
      "hyperframes_feedback_email=a@example.com\nHyperFrames_Feedback_Email=b@example.com\nOTHER=1",
      env,
    );
    expect(env).toEqual({ OTHER: "1" });
  });

  it("copies only exact allowed names when a caller limits the imported settings", () => {
    const env: NodeJS.ProcessEnv = { GEMINI_API_KEY: "inherited" };
    applyDotEnv(
      "GEMINI_API_KEY=project\nGOOGLE_API_KEY=allowed\ngoogle_api_key=other\nPATH=/untrusted\nLD_PRELOAD=payload",
      env,
      ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
    );
    expect(env).toEqual({ GEMINI_API_KEY: "inherited", GOOGLE_API_KEY: "allowed" });
  });

  it("an allowlist cannot opt the feedback email back in", () => {
    const env: NodeJS.ProcessEnv = {};
    applyDotEnv("HyperFrames_Feedback_Email=private", env, ["HyperFrames_Feedback_Email"]);
    expect(env).toEqual({});
  });

  it("an empty allowlist imports nothing", () => {
    const env: NodeJS.ProcessEnv = {};
    applyDotEnv("GEMINI_API_KEY=project", env, []);
    expect(env).toEqual({});
  });

  it("preserves quoted multiline values like JSON service accounts", () => {
    const env: NodeJS.ProcessEnv = {};
    const serviceAccountJson = `{\n  "type": "service_account",\n  "project_id": "test-project"\n}`;
    const dotEnvContent = `HYPERFRAMES_VERTEX_SERVICE_ACCOUNT="${serviceAccountJson}"\nNEXT_KEY=value\n`;
    applyDotEnv(dotEnvContent, env);
    expect(env).toEqual({
      HYPERFRAMES_VERTEX_SERVICE_ACCOUNT: serviceAccountJson,
      NEXT_KEY: "value",
    });
  });

  it("preserves single-quoted multiline strings across lines", () => {
    const env: NodeJS.ProcessEnv = {};
    const multilineText = `first line\nsecond line\nthird line`;
    applyDotEnv(`MULTILINE_VAL='${multilineText}'\nFOO=bar`, env);
    expect(env).toEqual({
      MULTILINE_VAL: multilineText,
      FOO: "bar",
    });
  });

  it("preserves multiline RSA certificates or private keys", () => {
    const env: NodeJS.ProcessEnv = {};
    const pemKey = `-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC6\n-----END PRIVATE KEY-----`;
    applyDotEnv(`PRIVATE_KEY="${pemKey}"\nOTHER=yes`, env);
    expect(env).toEqual({
      PRIVATE_KEY: pemKey,
      OTHER: "yes",
    });
  });

  it("handles multiline quoted values with escaped quotes and inline comments", () => {
    const env: NodeJS.ProcessEnv = {};
    const payload = `line1\nline2 with \\"escaped quotes\\"\nline3`;
    applyDotEnv(`CONF="${payload}" # trailing comment\nBAR=baz`, env);
    expect(env).toEqual({
      CONF: payload,
      BAR: "baz",
    });
  });

  it("handles CRLF line breaks in multiline values", () => {
    const env: NodeJS.ProcessEnv = {};
    const content = 'MULTI="first\r\nsecond\r\nthird"\r\nNEXT=val';
    applyDotEnv(content, env);
    expect(env).toEqual({
      MULTI: "first\nsecond\nthird",
      NEXT: "val",
    });
  });
});
