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
        item[key] = null;
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

export function validateFields(type: DocumentType, input: Fields): { fields: Fields; errors: string[] } {
  const fields = structuredClone(input);
  const errors: string[] = [];

  checkDates(fields, errors);
  if (type === "discharge_summary") checkDateOrder(fields, errors);
  if (type === "receipt") {
    checkAmounts(fields, errors);
    const items = fields.items?.value;
    if (Array.isArray(items)) checkItemArithmetic(items as Items, errors);
    checkItemTotals(fields, errors);
  }

  return { fields, errors };
}
