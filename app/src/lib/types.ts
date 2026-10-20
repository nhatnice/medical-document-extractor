export type DocumentType =
  | 'receipt'
  | 'discharge_summary'
  | 'lab_report'
  | 'prescription'

export type ExtractedField = { value: unknown; confidence: number }

export type ExtractionResult = {
  document_type: DocumentType
  confidence: number
  needs_review: boolean
  fields: Record<string, ExtractedField>
  validation_errors: string[]
}

export type Sample = { name: string; label: string; type: DocumentType }
