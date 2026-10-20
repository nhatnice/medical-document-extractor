import type { LlmCalls } from "./llm";
import { loadPages } from "./render";
import type { DocumentType } from "./schemas";
import { validateFields, type Fields, type Row } from "./validate";

export type ExtractionResult = {
  document_type: DocumentType;
  confidence: number;
  // True when the type is uncertain enough that a person should check the document before trusting the fields.
  needs_review: boolean;
  fields: Fields;
  validation_errors: string[];
};

const NULL_CONFIDENCE_CAP = 0.2;
// Below this the model is unsure of the type, e.g. a bill that also lists medicines.
const REVIEW_CONFIDENCE_THRESHOLD = 0.7;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  return Array.isArray(value) && value.length === 0;
}

function isRow(value: unknown): value is Row {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeFields(raw: Fields): Fields {
  const fields: Fields = {};
  for (const [name, field] of Object.entries(raw)) {
    const confidence = clamp01(field.confidence);
    if (isEmpty(field.value)) {
      fields[name] = { value: null, confidence: Math.min(confidence, NULL_CONFIDENCE_CAP) };
      continue;
    }
    const value = Array.isArray(field.value)
      ? field.value.map((row) =>
          isRow(row) && typeof row.confidence === "number" ? { ...row, confidence: clamp01(row.confidence) } : row,
        )
      : field.value;
    fields[name] = { value, confidence };
  }
  return fields;
}

// A list is only as trustworthy as its weakest row, so its confidence cannot exceed any row's.
function capListConfidence(fields: Fields): Fields {
  for (const field of Object.values(fields)) {
    if (!Array.isArray(field.value)) continue;
    const rowConfidences = field.value.filter(isRow).map((row) => row.confidence).filter((c): c is number => typeof c === "number");
    if (rowConfidences.length > 0) field.confidence = Math.min(field.confidence, ...rowConfidences);
  }
  return fields;
}

export async function runPipeline(bytes: Uint8Array, llm: LlmCalls, maxPages: number): Promise<ExtractionResult> {
  const pages = await loadPages(bytes, maxPages);
  const classification = await llm.classify(pages);
  const raw = await llm.extract(pages, classification.document_type);
  const { fields, errors } = validateFields(classification.document_type, normalizeFields(raw));
  const confidence = clamp01(classification.confidence);

  return {
    document_type: classification.document_type,
    confidence,
    needs_review: confidence < REVIEW_CONFIDENCE_THRESHOLD,
    fields: capListConfidence(fields),
    validation_errors: errors,
  };
}
