import type { ExtractionResult } from '../lib/types'
import { DocumentTypeBadge } from './DocumentTypeBadge'
import { FieldTable } from './FieldTable'
import { ResultActions } from './ResultActions'
import { ValidationErrorList } from './ValidationErrorList'

type Props = { result: ExtractionResult; fileName: string }

export function ResultPanel({ result, fileName }: Props) {
  return (
    <section className="card">
      <DocumentTypeBadge type={result.document_type} confidence={result.confidence} />
      <FieldTable fields={result.fields} />
      <h3>Validation errors</h3>
      <ValidationErrorList errors={result.validation_errors} />
      <ResultActions result={result} fileName={fileName} />
    </section>
  )
}
