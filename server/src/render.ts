import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { createCanvas } from "@napi-rs/canvas";

export type PageImage = { data: Uint8Array; mediaType: string };

export class InputError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

const RENDER_SCALE = 2;

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  return signature.every((byte, index) => bytes[index] === byte);
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.subarray(start, end));
}

export function sniffMediaType(bytes: Uint8Array): string | null {
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46])) return "application/pdf";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) return "image/png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") return "image/webp";
  return null;
}

async function renderPdf(bytes: Uint8Array, maxPages: number): Promise<PageImage[]> {
  const task = pdfjs.getDocument({ data: bytes, useSystemFonts: true });
  const doc = await task.promise;
  try {
    if (doc.numPages > maxPages) {
      throw new InputError(`PDF has ${doc.numPages} pages; the limit is ${maxPages}.`);
    }

    const pages: PageImage[] = [];
    for (let number = 1; number <= doc.numPages; number++) {
      const page = await doc.getPage(number);
      const viewport = page.getViewport({ scale: RENDER_SCALE });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      await page.render({
        canvas: canvas as unknown as Parameters<typeof page.render>[0]["canvas"],
        canvasContext: canvas.getContext("2d") as unknown as Parameters<typeof page.render>[0]["canvasContext"],
        viewport,
      }).promise;
      pages.push({ data: new Uint8Array(canvas.toBuffer("image/png")), mediaType: "image/png" });
    }
    return pages;
  } finally {
    await task.destroy();
  }
}

export async function loadPages(bytes: Uint8Array, maxPages: number): Promise<PageImage[]> {
  const mediaType = sniffMediaType(bytes);
  if (mediaType === "application/pdf") return renderPdf(bytes, maxPages);
  if (mediaType) return [{ data: bytes, mediaType }];
  throw new InputError("Unsupported file type. Send a PDF, PNG, JPEG or WEBP.");
}
