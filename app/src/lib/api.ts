import type { ExtractionResult } from './types'

export async function extractDocument(file: File): Promise<ExtractionResult> {
  const body = new FormData()
  body.append('file', file)
  const res = await fetch('/api/extract', { method: 'POST', body })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`)
  return data as ExtractionResult
}
