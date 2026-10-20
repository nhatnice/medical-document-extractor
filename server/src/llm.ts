import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText, Output } from "ai";
import { z } from "zod";
import { CLASSIFY_SYSTEM, extractSystem } from "./prompts";
import type { Config } from "./config";
import type { PageImage } from "./render";
import { classifySchema, extractionSchema, type DocumentType } from "./schemas";
import type { Fields } from "./validate";

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

// JSON mode drops the schema, so the model must see it in the prompt.
function withSchema(system: string, schema: z.ZodType): string {
  return `${system}\n\nThe JSON object must match this JSON Schema exactly:\n${JSON.stringify(z.toJSONSchema(schema))}`;
}

function imageParts(pages: PageImage[]) {
  return pages.map((page) => ({ type: "file" as const, data: page.data, mediaType: page.mediaType }));
}

export async function classifyDocument(model: Model, pages: PageImage[]) {
  const { output } = await generateText({
    model,
    temperature: 0,
    system: withSchema(CLASSIFY_SYSTEM, classifySchema),
    output: Output.object({ schema: classifySchema }),
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: "Classify this document." }, ...imageParts(pages)],
      },
    ],
  });
  return output;
}

export async function extractFields(model: Model, pages: PageImage[], type: DocumentType): Promise<Fields> {
  const { output } = await generateText({
    model,
    temperature: 0,
    system: withSchema(extractSystem(type), extractionSchema(type)),
    output: Output.object({ schema: extractionSchema(type) }),
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: `Extract the ${type} fields from these pages.` }, ...imageParts(pages)],
      },
    ],
  });
  return output.fields as Fields;
}
