import { describe, expect, test } from "bun:test";
import { TypeValidationError } from "ai";
import { withSchemaRetry } from "../src/llm";

describe("withSchemaRetry", () => {
  test("retries once when the reply does not match the schema", async () => {
    let calls = 0;
    const result = await withSchemaRetry(async () => {
      calls++;
      if (calls === 1) throw new TypeValidationError({ value: {}, cause: new Error("bad shape") });
      return "ok";
    });
    expect(result).toBe("ok");
    expect(calls).toBe(2);
  });

  test("gives up after the second schema failure", async () => {
    let calls = 0;
    const attempt = withSchemaRetry(async () => {
      calls++;
      throw new TypeValidationError({ value: {}, cause: new Error("bad shape") });
    });
    await expect(attempt).rejects.toBeInstanceOf(TypeValidationError);
    expect(calls).toBe(2);
  });

  test("other errors are not retried", async () => {
    let calls = 0;
    const attempt = withSchemaRetry(async () => {
      calls++;
      throw new Error("network down");
    });
    await expect(attempt).rejects.toThrow("network down");
    expect(calls).toBe(1);
  });
});
