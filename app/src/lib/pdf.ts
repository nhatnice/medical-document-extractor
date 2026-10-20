import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

// Renders page 1 of a PDF to a PNG data URL, scaled to fit the given width.
export async function renderFirstPage(blob: Blob, width: number): Promise<string> {
  const task = pdfjs.getDocument({ data: await blob.arrayBuffer() })
  try {
    const doc = await task.promise
    const page = await doc.getPage(1)
    const base = page.getViewport({ scale: 1 })
    const viewport = page.getViewport({ scale: (width * 2) / base.width })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    await page.render({ canvas, viewport }).promise
    return canvas.toDataURL('image/png')
  } finally {
    await task.destroy()
  }
}
