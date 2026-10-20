import { describe, expect, test } from "bun:test";
import { isLeapYear, parseIsoDate, validateFields, type Fields } from "../src/validate";

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

describe("date rules", () => {
  test("admission date that is not a real date is flagged and nulled", () => {
    const { fields, errors } = validateFields("discharge_summary", {
      admission_date: field("2026-02-30"),
      discharge_date: field("2026-03-01"),
    });
    expect(errors.filter((e) => e.startsWith("invalid_date"))).toHaveLength(1);
    expect(fields.admission_date).toEqual({ value: null, confidence: 0.1 });
    expect(fields.discharge_date?.value).toBe("2026-03-01");
  });

  test("discharge date that is not a real date is flagged and nulled", () => {
    const { fields, errors } = validateFields("discharge_summary", { discharge_date: field("2026-06-31") });
    expect(errors).toHaveLength(1);
    expect(fields.discharge_date?.value).toBeNull();
  });

  test("non-ISO date string is flagged", () => {
    const { errors } = validateFields("prescription", { date: field("03/04/2026") });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toStartWith("invalid_date");
  });

  test("invalid date does not trigger date_order", () => {
    const { errors } = validateFields("discharge_summary", {
      admission_date: field("2026-02-31"),
      discharge_date: field("2026-02-01"),
    });
    expect(errors.some((e) => e.startsWith("date_order"))).toBe(false);
  });

  test("date_order is only checked for discharge summaries", () => {
    const { errors } = validateFields("receipt", {
      admission_date: field("2026-02-09"),
      discharge_date: field("2026-02-03"),
    });
    expect(errors.some((e) => e.startsWith("date_order"))).toBe(false);
  });

  test("null dates produce no errors and keep their value", () => {
    const { fields, errors } = validateFields("discharge_summary", {
      admission_date: field(null, 0),
      discharge_date: field("2026-02-10"),
    });
    expect(errors).toEqual([]);
    expect(fields.admission_date).toEqual({ value: null, confidence: 0 });
  });
});

describe("amount rules", () => {
  test("zero grand_total is flagged and nulled", () => {
    const { fields, errors } = validateFields("receipt", { grand_total: field(0) });
    expect(errors).toEqual(["invalid_amount: grand_total must be a positive number, got 0"]);
    expect(fields.grand_total).toEqual({ value: null, confidence: 0.1 });
  });

  test("non-numeric amount is flagged and nulled", () => {
    const { fields, errors } = validateFields("receipt", { grand_total: field("1,050,000") });
    expect(errors).toHaveLength(1);
    expect(fields.grand_total?.value).toBeNull();
  });

  test("null grand_total is not flagged", () => {
    const { errors } = validateFields("receipt", { grand_total: field(null, 0) });
    expect(errors).toEqual([]);
  });

  test("negative item total is flagged and nulled, valid siblings are kept", () => {
    const { fields, errors } = validateFields("receipt", {
      items: field([
        { description: "a", quantity: 1, unit_price: 100, total: 100 },
        { description: "b", quantity: 1, unit_price: 50, total: -50 },
      ]),
    });
    expect(errors).toEqual(["invalid_amount: items[1].total must be a positive number, got -50"]);
    const items = fields.items?.value as Array<Record<string, unknown>>;
    expect(items[0]?.total).toBe(100);
    expect(items[1]?.total).toBeNull();
    expect(items[1]?.unit_price).toBe(50);
  });

  test("amount rules are not applied to non-receipt documents", () => {
    const { errors } = validateFields("lab_report", { grand_total: field(-5) });
    expect(errors).toEqual([]);
  });
});

describe("receipt arithmetic tolerance", () => {
  const line = (quantity: number, unitPrice: number, total: number) => ({
    description: "x",
    quantity,
    unit_price: unitPrice,
    total,
  });

  test("line total within 1% of quantity x unit_price is accepted", () => {
    const { errors } = validateFields("receipt", { items: field([line(2, 100, 202)]), grand_total: field(202) });
    expect(errors.some((e) => e.startsWith("item_arithmetic"))).toBe(false);
  });

  test("line total more than 1% away from quantity x unit_price is flagged", () => {
    const { errors } = validateFields("receipt", { items: field([line(2, 100, 205)]), grand_total: field(205) });
    expect(errors.some((e) => e.startsWith("item_arithmetic"))).toBe(true);
  });

  test("line with a missing quantity skips the arithmetic check", () => {
    const { errors } = validateFields("receipt", {
      items: field([{ description: "x", quantity: null, unit_price: 100, total: 900 }]),
      grand_total: field(900),
    });
    expect(errors.some((e) => e.startsWith("item_arithmetic"))).toBe(false);
  });

  test("item sum is compared against grand_total, not a subtotal", () => {
    const { errors } = validateFields("receipt", {
      items: field([line(1, 1000, 1000), line(1, 500, 500)]),
      grand_total: field(1500),
    });
    expect(errors).toEqual([]);
  });

  test("sum check is skipped when there are no items", () => {
    const { errors } = validateFields("receipt", { items: field([]), grand_total: field(1000) });
    expect(errors).toEqual([]);
  });

  test("sum check is skipped when grand_total is null", () => {
    const { errors } = validateFields("receipt", { items: field([line(1, 1000, 1000)]), grand_total: field(null, 0) });
    expect(errors).toEqual([]);
  });
});
