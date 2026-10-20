import { join, resolve, sep } from "node:path";
import { loadConfig } from "./src/config";
import { bindLlm, createModel } from "./src/llm";
import { InputError } from "./src/render";
import { runPipeline } from "./src/pipeline";

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const DIST_DIR = resolve(import.meta.dir, "../app/dist");

const config = loadConfig();
const llm = bindLlm(createModel(config));

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
    const result = await runPipeline(new Uint8Array(await file.arrayBuffer()), llm, config.maxPages);
    return Response.json(result);
  } catch (error) {
    if (error instanceof InputError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error(error);
    return Response.json({ error: "extraction failed" }, { status: 502 });
  }
}

// Serves the built React app. Unknown paths fall back to index.html so client-side routing works.
async function serveApp(pathname: string): Promise<Response | null> {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const filePath = resolve(DIST_DIR, "." + decoded);
  if (filePath !== DIST_DIR && !filePath.startsWith(DIST_DIR + sep)) return null;

  const asset = Bun.file(filePath);
  if (await asset.exists()) return new Response(asset);

  const index = Bun.file(join(DIST_DIR, "index.html"));
  return (await index.exists()) ? new Response(index) : null;
}

Bun.serve({
  port: config.port,
  routes: {
    "/api/extract": { POST: handleExtract },
  },
  async fetch(req) {
    const { pathname } = new URL(req.url);
    if (req.method === "GET" && !pathname.startsWith("/api/")) {
      const response = await serveApp(pathname);
      if (response) return response;
    }
    return Response.json({ error: "not found" }, { status: 404 });
  },
});

console.log(`Listening on http://localhost:${config.port}`);
