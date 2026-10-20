import { describe, expect, test } from "bun:test";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { InputError, loadPages, sniffMediaType } from "../src/render";

const SAMPLES = join(import.meta.dir, "../../mock/samples");
const bytes = (...b: number[]) => new Uint8Array(b);

describe("sniffMediaType", () => {
  test("detects PDF, PNG, JPEG and WEBP by magic bytes", () => {
    expect(sniffMediaType(new TextEncoder().encode("%PDF-1.7"))).toBe("application/pdf");
    expect(sniffMediaType(bytes(0x89, 0x50, 0x4e, 0x47))).toBe("image/png");
    expect(sniffMediaType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(sniffMediaType(new TextEncoder().encode("RIFF\0\0\0\0WEBP"))).toBe("image/webp");
  });

  test("rejects other content, including a spoofed extension and empty input", () => {
    expect(sniffMediaType(new TextEncoder().encode("<svg></svg>"))).toBeNull();
    expect(sniffMediaType(new TextEncoder().encode("RIFF\0\0\0\0WAVE"))).toBeNull();
    expect(sniffMediaType(new Uint8Array())).toBeNull();
  });
});

describe("loadPages", () => {
  test("unsupported bytes raise a 400 InputError", async () => {
    const error = await loadPages(bytes(1, 2, 3), 10).catch((e) => e);
    expect(error).toBeInstanceOf(InputError);
    expect(error.status).toBe(400);
  });

  test("renders every sample PDF to PNG pages", async () => {
    const pdfs = (await readdir(SAMPLES)).filter((f) => f.endsWith(".pdf"));
    expect(pdfs).toHaveLength(10);
    for (const file of pdfs) {
      const pages = await loadPages(new Uint8Array(await Bun.file(join(SAMPLES, file)).arrayBuffer()), 10);
      expect(pages.length).toBeGreaterThan(0);
      expect(pages[0]!.mediaType).toBe("image/png");
      expect(sniffMediaType(pages[0]!.data)).toBe("image/png");
    }
  });

  test("a PDF over the page limit is rejected", async () => {
    const file = join(SAMPLES, "receipt_01_sunrise_bill.pdf");
    const error = await loadPages(new Uint8Array(await Bun.file(file).arrayBuffer()), 0).catch((e) => e);
    expect(error).toBeInstanceOf(InputError);
    expect(error.message).toContain("limit");
  });
});
