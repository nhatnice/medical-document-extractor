import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText, Output } from "ai";
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
    supportsStructuredOutputs: true,
  });
  return provider(config.model);
}

export type Model = ReturnType<typeof createModel>;

function imageParts(pages: PageImage[]) {
  return pages.map((page) => ({ type: "file" as const, data: page.data, mediaType: page.mediaType }));
}

export async function classifyDocument(model: Model, pages: PageImage[]) {
  const { output } = await generateText({
    model,
    temperature: 0,
    system: CLASSIFY_SYSTEM,
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
    system: extractSystem(type),
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
