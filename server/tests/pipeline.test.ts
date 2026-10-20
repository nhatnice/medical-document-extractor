import { describe, expect, test } from "bun:test";
import type { LlmCalls } from "../src/llm";
import { InputError } from "../src/render";
import { runPipeline } from "../src/pipeline";
import type { Fields } from "../src/validate";

// A minimal PNG signature: loadPages passes images through without rendering, so no PDF work runs.
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const field = (value: unknown, confidence = 0.9) => ({ value, confidence });

function fakeLlm(classification: { document_type: "receipt" | "lab_report" | "prescription" | "discharge_summary"; confidence: number }, fields: Fields) {
  const calls = { classified: 0, extractedAs: [] as string[] };
  const llm: LlmCalls = {
    classify: async () => {
      calls.classified++;
      return classification;
    },
    extract: async (_pages, type) => {
      calls.extractedAs.push(type);
      return structuredClone(fields);
    },
  };
  return { llm, calls };
}

describe("runPipeline", () => {
  test("extracts with the type returned by classification", async () => {
    const { llm, calls } = fakeLlm({ document_type: "lab_report", confidence: 0.9 }, {});
    await runPipeline(PNG, llm, 10);
    expect(calls.classified).toBe(1);
    expect(calls.extractedAs).toEqual(["lab_report"]);
  });

  test("passes classification confidence through, clamped to 0..1", async () => {
    const { llm } = fakeLlm({ document_type: "prescription", confidence: 1.4 }, {});
    expect((await runPipeline(PNG, llm, 10)).confidence).toBe(1);
  });

  test("empty field values are nulled and their confidence capped at 0.2", async () => {
    const { llm } = fakeLlm(
      { document_type: "prescription", confidence: 0.9 },
      { doctor_name: field("   ", 0.95), date: field(null, 0.7), medications: field([], 0.9) },
    );
    const result = await runPipeline(PNG, llm, 10);
    expect(result.fields.doctor_name).toEqual({ value: null, confidence: 0.2 });
    expect(result.fields.date).toEqual({ value: null, confidence: 0.2 });
    expect(result.fields.medications).toEqual({ value: null, confidence: 0.2 });
  });

  test("filled field keeps its value and confidence, clamped to 0..1", async () => {
    const { llm } = fakeLlm({ document_type: "prescription", confidence: 0.9 }, { doctor_name: field("Dr. Tran", 1.7) });
    const result = await runPipeline(PNG, llm, 10);
    expect(result.fields.doctor_name).toEqual({ value: "Dr. Tran", confidence: 1 });
  });

  test("validation errors come from the validator", async () => {
    const { llm } = fakeLlm(
      { document_type: "receipt", confidence: 0.9 },
      {
        items: field([{ description: "x", quantity: 1, unit_price: 1000, total: 1000 }]),
        grand_total: field(1200),
        date: field("2026-02-31"),
      },
    );
    const result = await runPipeline(PNG, llm, 10);
    expect(result.validation_errors.some((e) => e.startsWith("amount_mismatch"))).toBe(true);
    expect(result.validation_errors.some((e) => e.startsWith("invalid_date"))).toBe(true);
    expect(result.fields.date?.value).toBeNull();
  });

  test("a clean document has no validation errors", async () => {
    const { llm } = fakeLlm(
      { document_type: "receipt", confidence: 0.95 },
      { items: field([{ description: "x", quantity: 1, unit_price: 1000, total: 1000 }]), grand_total: field(1000), date: field("2026-03-15") },
    );
    expect((await runPipeline(PNG, llm, 10)).validation_errors).toEqual([]);
  });

  test("unsupported file type is rejected before any LLM call", async () => {
    const { llm, calls } = fakeLlm({ document_type: "receipt", confidence: 0.9 }, {});
    await expect(runPipeline(new Uint8Array([1, 2, 3, 4]), llm, 10)).rejects.toBeInstanceOf(InputError);
    expect(calls.classified).toBe(0);
  });
});
