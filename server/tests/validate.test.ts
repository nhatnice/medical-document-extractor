import { describe, expect, test } from "bun:test";
import { isLeapYear, parseIsoDate, validateFields, type Fields } from "./validate";

const field = (value: unknown, confidence = 0.9) => ({ value, confidence });

describe("dates", () => {
  test("leap years", () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2000)).toBe(true);
    expect(isLeapYear(1900)).toBe(false);
    expect(isLeapYear(2026)).toBe(false);
  });

  test("accepts real dates and rejects impossible ones", () => {
    expect(parseIsoDate("2024-02-29")).not.toBeNull();
    expect(parseIsoDate("2026-02-29")).toBeNull();
    expect(parseIsoDate("2026-02-31")).toBeNull();
    expect(parseIsoDate("2026-04-31")).toBeNull();
    expect(parseIsoDate("2026-13-01")).toBeNull();
    expect(parseIsoDate("31/02/2026")).toBeNull();
    expect(parseIsoDate(null)).toBeNull();
  });

  test("lab report with impossible date is flagged and nulled", () => {
    const { fields, errors } = validateFields("lab_report", { date: field("2026-02-31", 0.8) });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toStartWith("invalid_date");
    expect(fields.date).toEqual({ value: null, confidence: 0.1 });
  });

  test("discharge date before admission date is flagged", () => {
    const { errors } = validateFields("discharge_summary", {
      admission_date: field("2026-02-09"),
      discharge_date: field("2026-02-03"),
    });
    expect(errors.some((e) => e.startsWith("date_order"))).toBe(true);
  });

  test("discharge on admission day is allowed", () => {
    const { errors } = validateFields("discharge_summary", {
      admission_date: field("2026-02-03"),
      discharge_date: field("2026-02-03"),
    });
    expect(errors).toEqual([]);
  });
});

describe("receipts", () => {
  const items = (totals: number[]) =>
    totals.map((total) => ({ description: "x", quantity: 1, unit_price: total, total }));

  test("matching total passes", () => {
    const { errors } = validateFields("receipt", {
      items: field(items([500000, 300000, 250000])),
      grand_total: field(1050000),
    });
    expect(errors).toEqual([]);
  });

  test("5.95% mismatch is flagged", () => {
    const { errors } = validateFields("receipt", {
      items: field(items([600000, 380000, 380000, 220000])),
      grand_total: field(1680000),
    });
    expect(errors.some((e) => e.startsWith("amount_mismatch"))).toBe(true);
  });

  test("exactly 5% deviation is not flagged", () => {
    const { errors } = validateFields("receipt", {
      items: field(items([950])),
      grand_total: field(1000),
    });
    expect(errors.some((e) => e.startsWith("amount_mismatch"))).toBe(false);
  });

  test("missing item total skips the sum check", () => {
    const { errors } = validateFields("receipt", {
      items: field([{ description: "x", quantity: null, unit_price: null, total: null }]),
      grand_total: field(1000),
    });
    expect(errors).toEqual([]);
  });

  test("non-positive amounts are flagged and nulled", () => {
    const fields: Fields = { grand_total: field(-5), items: field([{ description: "x", quantity: 1, unit_price: 0, total: 0 }]) };
    const { fields: out, errors } = validateFields("receipt", fields);
    expect(errors.filter((e) => e.startsWith("invalid_amount"))).toHaveLength(3);
    expect(out.grand_total?.value).toBeNull();
    expect((out.items?.value as Array<Record<string, unknown>>)[0]?.total).toBeNull();
  });

  test("item arithmetic mismatch is flagged", () => {
    const { errors } = validateFields("receipt", {
      items: field([{ description: "x", quantity: 2, unit_price: 800, total: 1600 }, { description: "y", quantity: 3, unit_price: 75, total: 300 }]),
      grand_total: field(1900),
    });
    expect(errors.some((e) => e.startsWith("item_arithmetic"))).toBe(true);
  });
});

test("does not mutate input", () => {
  const input: Fields = { date: field("2026-02-31") };
  validateFields("prescription", input);
  expect(input.date?.value).toBe("2026-02-31");
});
