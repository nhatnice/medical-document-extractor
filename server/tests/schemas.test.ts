import { describe, expect, test } from "bun:test";
import { DOCUMENT_TYPES, classifySchema, extractionSchema } from "../src/schemas";

// The field names required by CHALLENGE_08.md, per type.
const REQUIRED: Record<(typeof DOCUMENT_TYPES)[number], string[]> = {
  receipt: ["hospital_name", "patient_name", "date", "items", "grand_total", "payment_method"],
  discharge_summary: ["hospital_name", "patient_name", "admission_date", "discharge_date", "diagnosis", "procedures_performed", "attending_physician", "discharge_instructions"],
  lab_report: ["lab_name", "patient_name", "date", "tests"],
  prescription: ["doctor_name", "patient_name", "date", "medications"],
};

describe("extractionSchema", () => {
  for (const type of DOCUMENT_TYPES) {
    test(`${type} exposes exactly the specified fields`, () => {
      const shape = extractionSchema(type).shape.fields.shape;
      expect(Object.keys(shape).sort()).toEqual([...REQUIRED[type]].sort());
    });

    test(`${type}: every field accepts value null with a confidence`, () => {
      const fields = Object.fromEntries(REQUIRED[type].map((name) => [name, { value: null, confidence: 0 }]));
      expect(extractionSchema(type).safeParse({ fields }).success).toBe(true);
    });
  }

  test("every list row needs its own confidence", () => {
    const fields = Object.fromEntries(REQUIRED.receipt.map((name) => [name, { value: null, confidence: 0.5 }]));
    const item = { description: "x", quantity: 1, unit_price: 1, total: 1 };
    const parse = (row: object) =>
      extractionSchema("receipt").safeParse({ fields: { ...fields, items: { value: [row], confidence: 0.9 } } }).success;
    expect(parse({ ...item, confidence: 0.8 })).toBe(true);
    expect(parse(item)).toBe(false);
  });

  test("confidence outside 0..1 is rejected", () => {
    const fields = Object.fromEntries(REQUIRED.prescription.map((name) => [name, { value: null, confidence: 1.5 }]));
    expect(extractionSchema("prescription").safeParse({ fields }).success).toBe(false);
  });

  test("lab flag only accepts normal, high or low", () => {
    const fields = Object.fromEntries(REQUIRED.lab_report.map((name) => [name, { value: null, confidence: 0.5 }]));
    const row = (flag: string) => ({ test_name: "Hb", result: "1", unit: "g", reference_range: "1-2", flag, confidence: 0.9 });
    const parse = (flag: string) =>
      extractionSchema("lab_report").safeParse({ fields: { ...fields, tests: { value: [row(flag)], confidence: 0.9 } } }).success;
    expect(parse("high")).toBe(true);
    expect(parse("critical")).toBe(false);
  });
});

describe("classifySchema", () => {
  test("accepts only the four document types", () => {
    for (const type of DOCUMENT_TYPES) expect(classifySchema.safeParse({ document_type: type, confidence: 0.9 }).success).toBe(true);
    expect(classifySchema.safeParse({ document_type: "invoice", confidence: 0.9 }).success).toBe(false);
  });
});
