import { resolve } from "node:path";
import { loadConfig } from "./src/config";
import { createHandler, MAX_BODY_BYTES } from "./src/http";
import { bindLlm, createModel } from "./src/llm";

const config = loadConfig();

Bun.serve({
  port: config.port,
  maxRequestBodySize: MAX_BODY_BYTES,
  // Extraction makes two sequential LLM calls; Bun's 10 s default would cut the response off.
  idleTimeout: 120,
  fetch: createHandler({
    llm: bindLlm(createModel(config)),
    maxPages: config.maxPages,
    maxConcurrent: config.maxConcurrent,
    distDir: resolve(import.meta.dir, "../app/dist"),
  }),
});

console.log(`Listening on http://localhost:${config.port}`);
