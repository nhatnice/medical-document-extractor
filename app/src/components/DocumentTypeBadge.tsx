import { confidenceLevel } from '../lib/confidence'
import type { DocumentType } from '../lib/types'

type Props = { type: DocumentType; confidence: number }

export function DocumentTypeBadge({ type, confidence }: Props) {
  return (
    <div className="type-badge">
      <span className="type-name">{type.replace('_', ' ')}</span>
      <span className={`pill ${confidenceLevel(confidence)}`}>
        {(confidence * 100).toFixed(0)}% confidence
      </span>
    </div>
  )
}
