import { afterEach, describe, expect, test } from "bun:test";
import { loadConfig } from "../src/config";

const KEYS = ["LLM_API_KEY", "LLM_BASE_URL", "LLM_MODEL", "PORT", "MAX_PAGES", "MAX_CONCURRENT"];
const saved = Object.fromEntries(KEYS.map((k) => [k, Bun.env[k]]));

function setEnv(env: Record<string, string | undefined>) {
  for (const k of KEYS) delete Bun.env[k];
  for (const [k, v] of Object.entries(env)) if (v !== undefined) Bun.env[k] = v;
}

afterEach(() => setEnv(saved as Record<string, string | undefined>));

const base = { LLM_API_KEY: "k", LLM_BASE_URL: "http://llm", LLM_MODEL: "m" };

describe("loadConfig", () => {
  test("applies defaults", () => {
    setEnv(base);
    expect(loadConfig()).toMatchObject({ port: 3000, maxPages: 10, maxConcurrent: 4, model: "m" });
  });

  test("missing or blank required vars throw without echoing values", () => {
    setEnv({ ...base, LLM_API_KEY: "  " });
    expect(() => loadConfig()).toThrow("LLM_API_KEY");
  });

  test("non-numeric or non-positive numbers throw instead of becoming NaN", () => {
    for (const bad of ["abc", "0", "-1", "1.5"]) {
      setEnv({ ...base, MAX_PAGES: bad });
      expect(() => loadConfig()).toThrow("MAX_PAGES");
    }
  });
});
