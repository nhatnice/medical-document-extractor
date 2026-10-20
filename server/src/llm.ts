import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText, JSONParseError, NoObjectGeneratedError, Output, TypeValidationError } from "ai";
import { z } from "zod";
import { CLASSIFY_SYSTEM, extractSystem } from "./prompts";
import type { Config } from "./config";
import type { PageImage } from "./render";
import { classifySchema, extractionSchema, type DocumentType } from "./schemas";
import type { Fields } from "./validate";

const LLM_TIMEOUT_MS = 60_000;
// One extra attempt covers a stray malformed JSON reply; more would mostly repeat the same mistake.
const MAX_SCHEMA_ATTEMPTS = 2;

export function createModel(config: Config) {
  const provider = createOpenAICompatible({
    name: "llm",
    apiKey: config.apiKey,
    baseURL: config.baseURL,
    // DeepSeek only accepts response_format json_object, not json_schema
    supportsStructuredOutputs: false,
  });
  return provider(config.model);
}

export type Model = ReturnType<typeof createModel>;

function isSchemaFailure(error: unknown): boolean {
  return (
    NoObjectGeneratedError.isInstance(error) ||
    TypeValidationError.isInstance(error) ||
    JSONParseError.isInstance(error)
  );
}

// Retries only when the reply is not valid JSON for the schema. Network and timeout errors propagate as-is.
export async function withSchemaRetry<T>(call: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await call();
    } catch (error) {
      if (!isSchemaFailure(error) || attempt >= MAX_SCHEMA_ATTEMPTS) throw error;
      console.warn(`LLM reply did not match the schema, retrying (attempt ${attempt + 1}/${MAX_SCHEMA_ATTEMPTS})`);
    }
  }
}

// JSON mode drops the schema, so the model must see it in the prompt.
function withSchema(system: string, schema: z.ZodType): string {
  return `${system}\n\nThe JSON object must match this JSON Schema exactly:\n${JSON.stringify(z.toJSONSchema(schema))}`;
}

function imageParts(pages: PageImage[]) {
  return pages.map((page) => ({ type: "file" as const, data: page.data, mediaType: page.mediaType }));
}

// Prompt and messages are built once, so a retry only repeats the network call.
async function generateObject<T extends z.ZodType>(
  model: Model,
  systemPrompt: string,
  schema: T,
  instruction: string,
  pages: PageImage[],
): Promise<z.infer<T>> {
  const system = withSchema(systemPrompt, schema);
  const messages = [
    { role: "user" as const, content: [{ type: "text" as const, text: instruction }, ...imageParts(pages)] },
  ];
  const { output } = await withSchemaRetry(() =>
    generateText({
      model,
      temperature: 0,
      abortSignal: AbortSignal.timeout(LLM_TIMEOUT_MS),
      system,
      output: Output.object({ schema }),
      messages,
    }),
  );
  return output as z.infer<T>;
}

export function classifyDocument(model: Model, pages: PageImage[]) {
  return generateObject(model, CLASSIFY_SYSTEM, classifySchema, "Classify this document.", pages);
}

export async function extractFields(model: Model, pages: PageImage[], type: DocumentType): Promise<Fields> {
  const output = await generateObject(
    model,
    extractSystem(type),
    extractionSchema(type),
    `Extract the ${type} fields from these pages.`,
    pages,
  );
  return output.fields as Fields;
}

export type LlmCalls = {
  classify: (pages: PageImage[]) => Promise<{ document_type: DocumentType; confidence: number }>;
  extract: (pages: PageImage[], type: DocumentType) => Promise<Fields>;
};

export function bindLlm(model: Model): LlmCalls {
  return {
    classify: (pages) => classifyDocument(model, pages),
    extract: (pages, type) => extractFields(model, pages, type),
  };
}
