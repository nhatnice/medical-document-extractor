import { loadConfig } from "./src/config";
import { createModel } from "./src/llm";
import { InputError } from "./src/render";
import { runPipeline } from "./src/pipeline";

const MAX_FILE_BYTES = 20 * 1024 * 1024;

const config = loadConfig();
const model = createModel(config);

async function handleExtract(req: Request): Promise<Response> {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: 'multipart field "file" is required' }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return Response.json({ error: "file exceeds 20 MB" }, { status: 413 });
  }

  try {
    const result = await runPipeline(new Uint8Array(await file.arrayBuffer()), model, config.maxPages);
    return Response.json(result);
  } catch (error) {
    if (error instanceof InputError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error(error);
    return Response.json({ error: "extraction failed" }, { status: 502 });
  }
}

Bun.serve({
  port: config.port,
  routes: {
    "/api/extract": { POST: handleExtract },
  },
  fetch() {
    return Response.json({ error: "not found" }, { status: 404 });
  },
});

console.log(`Listening on http://localhost:${config.port}`);
