import { describe, expect, test } from "bun:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHandler, MAX_BODY_BYTES } from "../src/http";
import type { LlmCalls } from "../src/llm";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const llm: LlmCalls = {
  classify: async () => ({ document_type: "prescription", confidence: 0.9 }),
  extract: async () => ({ doctor_name: { value: "Dr. A", confidence: 0.9 } }),
};

async function setup(overrides: Partial<Parameters<typeof createHandler>[0]> = {}) {
  const distDir = await mkdtemp(join(tmpdir(), "dist-"));
  await writeFile(join(distDir, "index.html"), "<html>app</html>");
  await writeFile(join(distDir, "asset.js"), "console.log(1)");
  return createHandler({ llm, maxPages: 10, maxConcurrent: 4, distDir, ...overrides });
}

function upload(bytes: Uint8Array, headers: Record<string, string> = {}) {
  const body = new FormData();
  body.append("file", new File([bytes], "doc.png"));
  return new Request("http://x/api/extract", { method: "POST", body, headers });
}

describe("POST /api/extract", () => {
  test("returns the extraction result", async () => {
    const res = await (await setup())(upload(PNG));
    expect(res.status).toBe(200);
    expect(((await res.json()) as { document_type: string }).document_type).toBe("prescription");
  });

  test("missing file field is 400", async () => {
    const res = await (await setup())(new Request("http://x/api/extract", { method: "POST", body: new FormData() }));
    expect(res.status).toBe(400);
  });

  test("non-multipart body is 400", async () => {
    const res = await (await setup())(new Request("http://x/api/extract", { method: "POST", body: "nope" }));
    expect(res.status).toBe(400);
  });

  test("unsupported file type is 400", async () => {
    const res = await (await setup())(upload(new TextEncoder().encode("plain text")));
    expect(res.status).toBe(400);
  });

  test("corrupt PDF is a client error, not a 502", async () => {
    const res = await (await setup())(upload(new TextEncoder().encode("%PDF-1.4 garbage")));
    expect(res.status).toBe(422);
  });

  test("declared oversize body is 413 before it is read", async () => {
    const res = await (await setup())(upload(PNG, { "content-length": String(MAX_BODY_BYTES + 1) }));
    expect(res.status).toBe(413);
  });

  test("LLM failure is a generic 502 that does not leak the error", async () => {
    const failing: LlmCalls = { ...llm, classify: async () => { throw new Error("secret-key-leak"); } };
    const res = await (await setup({ llm: failing }))(upload(PNG));
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain("secret-key-leak");
  });

  test("requests beyond maxConcurrent get 429 and the slot is released afterwards", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const slow: LlmCalls = { ...llm, classify: async () => (await gate, { document_type: "prescription", confidence: 0.9 }) };
    const handler = await setup({ llm: slow, maxConcurrent: 1 });

    const first = handler(upload(PNG));
    await Bun.sleep(20);
    expect((await handler(upload(PNG))).status).toBe(429);

    release();
    expect((await first).status).toBe(200);
    expect((await handler(upload(PNG))).status).toBe(200);
  });

  test("other methods are 405", async () => {
    const res = await (await setup())(new Request("http://x/api/extract"));
    expect(res.status).toBe(405);
  });
});

describe("static app", () => {
  test("serves assets and falls back to index.html", async () => {
    const handler = await setup();
    expect(await (await handler(new Request("http://x/asset.js"))).text()).toBe("console.log(1)");
    expect(await (await handler(new Request("http://x/some/route"))).text()).toBe("<html>app</html>");
  });

  test("path traversal never leaves the dist directory", async () => {
    const handler = await setup();
    for (const path of ["/../package.json", "/%2e%2e/package.json", "/..%2f..%2fetc/passwd", "/%00"]) {
      const res = await handler(new Request(`http://x${path}`));
      expect(await res.text()).not.toContain('"name"');
    }
  });

  test("unknown /api paths are 404 JSON", async () => {
    expect((await (await setup())(new Request("http://x/api/nope"))).status).toBe(404);
  });

  test("responses carry security headers", async () => {
    const res = await (await setup())(new Request("http://x/"));
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("content-security-policy")).toContain("default-src 'self'");
  });
});
