import type { DocumentType } from "./schemas";

export type FieldResult = { value: unknown; confidence: number };
export type Fields = Record<string, FieldResult>;

const DATE_FIELDS = ["date", "admission_date", "discharge_date"];
const AMOUNT_TOTAL_TOLERANCE = 0.05;
const INVALID_CONFIDENCE_CAP = 0.1;

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  const days = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return days[month - 1] ?? 0;
}

export function parseIsoDate(raw: unknown): Date | null {
  if (typeof raw !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

export function isPositiveAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function invalidate(field: FieldResult): void {
  field.value = null;
  field.confidence = Math.min(field.confidence, INVALID_CONFIDENCE_CAP);
}

type Items = Array<Record<string, unknown>>;
export type Row = Record<string, unknown>;

// Clears one value inside a list row. The row's own confidence is capped, like a top-level field.
function invalidateRow(row: Row, key: string): void {
  row[key] = null;
  if (typeof row.confidence === "number") row.confidence = Math.min(row.confidence, INVALID_CONFIDENCE_CAP);
}

// Comma is accepted as a decimal mark.
const NUM = String.raw`(-?\d+(?:[.,]\d+)?)`;
const toNumber = (text: string) => Number(text.replace(",", "."));
const LEADING_NUMBER = new RegExp(`^\\s*${NUM}`);
const RANGE_BETWEEN = new RegExp(`^${NUM}\\s*(?:-|–|—|to)\\s*${NUM}`, "i");
const RANGE_ONE_SIDED = new RegExp(`^(<|>)=?\\s*${NUM}|^(≤|≥)\\s*${NUM}`);

// Reads the leading number of a printed value such as "3.5", "21 capsules" or "7 days".
function leadingNumber(raw: unknown): number | null {
  if (typeof raw !== "string") return null;
  const match = LEADING_NUMBER.exec(raw);
  return match?.[1] ? toNumber(match[1]) : null;
}

type Range = { low?: number; high?: number };

// Handles "3.5 - 5.0", "< 200" and "> 40". Other shapes return null, so the flag check is skipped.
export function parseReferenceRange(raw: unknown): Range | null {
  if (typeof raw !== "string") return null;
  const text = raw.trim();
  const between = RANGE_BETWEEN.exec(text);
  if (between) return { low: toNumber(between[1]!), high: toNumber(between[2]!) };
  const oneSided = RANGE_ONE_SIDED.exec(text);
  if (!oneSided) return null;
  const operator = oneSided[1] ?? oneSided[3];
  const bound = toNumber(oneSided[2] ?? oneSided[4]!);
  return operator === "<" || operator === "≤" ? { high: bound } : { low: bound };
}

function deriveFlag(value: number, range: Range): "low" | "high" | "normal" {
  if (range.low !== undefined && value < range.low) return "low";
  if (range.high !== undefined && value > range.high) return "high";
  return "normal";
}

function checkDates(fields: Fields, errors: string[]): void {
  for (const name of DATE_FIELDS) {
    const field = fields[name];
    if (!field || field.value === null) continue;
    if (parseIsoDate(field.value) === null) {
      errors.push(`invalid_date: ${name} "${String(field.value)}" is not a real calendar date`);
      invalidate(field);
    }
  }
}

function checkDateOrder(fields: Fields, errors: string[]): void {
  const admission = fields.admission_date?.value;
  const discharge = fields.discharge_date?.value;
  const admitted = parseIsoDate(admission);
  const discharged = parseIsoDate(discharge);
  if (admitted && discharged && discharged < admitted) {
    errors.push(`date_order: discharge_date ${discharge} is before admission_date ${admission}`);
  }
}

function checkAmounts(fields: Fields, errors: string[]): void {
  const grandTotal = fields.grand_total;
  if (grandTotal && grandTotal.value !== null && !isPositiveAmount(grandTotal.value)) {
    errors.push(`invalid_amount: grand_total must be a positive number, got ${String(grandTotal.value)}`);
    invalidate(grandTotal);
  }

  const items = fields.items?.value;
  if (!Array.isArray(items)) return;
  (items as Items).forEach((item, index) => {
    for (const key of ["unit_price", "total"]) {
      const value = item[key];
      if (value !== null && value !== undefined && !isPositiveAmount(value)) {
        errors.push(`invalid_amount: items[${index}].${key} must be a positive number, got ${String(value)}`);
        invalidateRow(item, key);
      }
    }
  });
}

function checkItemArithmetic(items: Items, errors: string[]): void {
  items.forEach((item, index) => {
    const { quantity, unit_price: unitPrice, total } = item;
    if (!isPositiveAmount(quantity) || !isPositiveAmount(unitPrice) || !isPositiveAmount(total)) return;
    if (Math.abs(quantity * unitPrice - total) > 0.01 * total) {
      errors.push(`item_arithmetic: items[${index}] quantity ${quantity} x unit_price ${unitPrice} = ${quantity * unitPrice}, but total is ${total}`);
    }
  });
}

function checkItemTotals(fields: Fields, errors: string[]): void {
  const grandTotal = fields.grand_total?.value;
  const items = fields.items?.value;
  if (!isPositiveAmount(grandTotal) || !Array.isArray(items) || items.length === 0) return;

  const totals = (items as Items).map((item) => item.total);
  if (!totals.every(isPositiveAmount)) return;

  const sum = (totals as number[]).reduce((acc, total) => acc + total, 0);
  const deviation = Math.abs(sum - grandTotal) / grandTotal;
  if (deviation > AMOUNT_TOTAL_TOLERANCE) {
    errors.push(
      `amount_mismatch: items total ${sum} differs from grand_total ${grandTotal} by ${(deviation * 100).toFixed(2)}% (> 5%)`,
    );
  }
}

function checkTestFlags(items: Items, errors: string[]): void {
  items.forEach((test, index) => {
    const range = parseReferenceRange(test.reference_range);
    const value = leadingNumber(test.result);
    if (!range || value === null || typeof test.flag !== "string") return;
    const expected = deriveFlag(value, range);
    if (test.flag !== expected) {
      errors.push(
        `flag_mismatch: tests[${index}] "${String(test.test_name)}" is flagged ${test.flag}, but result ${String(test.result)} against reference ${String(test.reference_range)} is ${expected}`,
      );
      invalidateRow(test, "flag");
    }
  });
}

// Only checks that a printed number is positive. Free text such as "one box" is left alone.
function checkPositiveCount(medications: Items, key: "quantity" | "duration", errors: string[]): void {
  medications.forEach((row, index) => {
    const count = leadingNumber(row[key]);
    if (count !== null && count <= 0) {
      errors.push(`invalid_${key}: medications[${index}].${key} must be positive, got "${String(row[key])}"`);
      invalidateRow(row, key);
    }
  });
}

export function validateFields(type: DocumentType, input: Fields): { fields: Fields; errors: string[] } {
  const fields = structuredClone(input);
  const errors: string[] = [];

  checkDates(fields, errors);
  if (type === "discharge_summary") checkDateOrder(fields, errors);
  if (type === "lab_report" && Array.isArray(fields.tests?.value)) checkTestFlags(fields.tests.value as Items, errors);
  if (type === "prescription" && Array.isArray(fields.medications?.value)) {
    const medications = fields.medications.value as Items;
    checkPositiveCount(medications, "quantity", errors);
    checkPositiveCount(medications, "duration", errors);
  }
  if (type === "receipt") {
    checkAmounts(fields, errors);
    const items = fields.items?.value;
    if (Array.isArray(items)) checkItemArithmetic(items as Items, errors);
    checkItemTotals(fields, errors);
  }

  return { fields, errors };
}
