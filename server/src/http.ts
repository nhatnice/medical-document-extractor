import { join, resolve, sep } from "node:path";
import type { LlmCalls } from "./llm";
import { runPipeline } from "./pipeline";
import { InputError } from "./render";

export const MAX_FILE_BYTES = 20 * 1024 * 1024;
// Multipart framing adds a little on top of the file itself.
export const MAX_BODY_BYTES = MAX_FILE_BYTES + 1024 * 1024;

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; worker-src 'self' blob:; frame-ancestors 'none'",
};

export type HandlerOptions = {
  llm: LlmCalls;
  maxPages: number;
  maxConcurrent: number;
  distDir: string;
};

function withHeaders(response: Response): Response {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) response.headers.set(name, value);
  return response;
}

// Serves the built React app. Unknown paths fall back to index.html so client-side routing works.
async function serveApp(distDir: string, pathname: string): Promise<Response | null> {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes("\0")) return null;
  const filePath = resolve(distDir, "." + decoded);
  if (filePath !== distDir && !filePath.startsWith(distDir + sep)) return null;

  const asset = Bun.file(filePath);
  if (await asset.exists()) return new Response(asset);

  const index = Bun.file(join(distDir, "index.html"));
  return (await index.exists()) ? new Response(index) : null;
}

export function createHandler({ llm, maxPages, maxConcurrent, distDir }: HandlerOptions) {
  const root = resolve(distDir);
  let inFlight = 0;

  async function extract(req: Request): Promise<Response> {
    const declared = Number(req.headers.get("content-length"));
    if (declared > MAX_BODY_BYTES) return Response.json({ error: "file exceeds 20 MB" }, { status: 413 });

    // Every request costs LLM calls, so cap how many run at once.
    if (inFlight >= maxConcurrent) {
      return Response.json({ error: "server busy, retry shortly" }, { status: 429, headers: { "Retry-After": "5" } });
    }
    inFlight++;
    try {
      const form = await req.formData().catch(() => null);
      const file = form?.get("file");
      if (!(file instanceof File)) {
        return Response.json({ error: 'multipart field "file" is required' }, { status: 400 });
      }
      if (file.size > MAX_FILE_BYTES) {
        return Response.json({ error: "file exceeds 20 MB" }, { status: 413 });
      }
      return Response.json(await runPipeline(new Uint8Array(await file.arrayBuffer()), llm, maxPages));
    } catch (error) {
      if (error instanceof InputError) return Response.json({ error: error.message }, { status: error.status });
      console.error(error);
      return Response.json({ error: "extraction failed" }, { status: 502 });
    } finally {
      inFlight--;
    }
  }

  return async (req: Request): Promise<Response> => {
    const { pathname } = new URL(req.url);
    if (pathname === "/api/extract") {
      if (req.method !== "POST") {
        return withHeaders(Response.json({ error: "method not allowed" }, { status: 405, headers: { Allow: "POST" } }));
      }
      return withHeaders(await extract(req));
    }
    if (req.method === "GET" && !pathname.startsWith("/api/")) {
      const response = await serveApp(root, pathname);
      if (response) return withHeaders(response);
    }
    return withHeaders(Response.json({ error: "not found" }, { status: 404 }));
  };
}
