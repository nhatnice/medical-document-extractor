import type { LlmCalls } from "./llm";
import { loadPages } from "./render";
import type { DocumentType } from "./schemas";
import { validateFields, type Fields } from "./validate";

export type ExtractionResult = {
  document_type: DocumentType;
  confidence: number;
  fields: Fields;
  validation_errors: string[];
};

const NULL_CONFIDENCE_CAP = 0.2;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  return Array.isArray(value) && value.length === 0;
}

function normalizeFields(raw: Fields): Fields {
  const fields: Fields = {};
  for (const [name, field] of Object.entries(raw)) {
    const confidence = clamp01(field.confidence);
    fields[name] = isEmpty(field.value)
      ? { value: null, confidence: Math.min(confidence, NULL_CONFIDENCE_CAP) }
      : { value: field.value, confidence };
  }
  return fields;
}

export async function runPipeline(bytes: Uint8Array, llm: LlmCalls, maxPages: number): Promise<ExtractionResult> {
  const pages = await loadPages(bytes, maxPages);
  const classification = await llm.classify(pages);
  const raw = await llm.extract(pages, classification.document_type);
  const { fields, errors } = validateFields(classification.document_type, normalizeFields(raw));

  return {
    document_type: classification.document_type,
    confidence: clamp01(classification.confidence),
    fields,
    validation_errors: errors,
  };
}
