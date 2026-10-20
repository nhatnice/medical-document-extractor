import { confidenceLevel } from '../lib/confidence'
import type { ExtractedField } from '../lib/types'

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'string') return value
  return JSON.stringify(value, null, 2)
}

export function FieldTable({ fields }: { fields: Record<string, ExtractedField> }) {
  return (
    <table className="fields">
      <thead>
        <tr>
          <th>Field</th>
          <th>Value</th>
          <th>Confidence</th>
        </tr>
      </thead>
      <tbody>
        {Object.entries(fields).map(([name, field]) => (
          <tr key={name} className={`row ${confidenceLevel(field.confidence)}`}>
            <td>{name}</td>
            <td>
              <pre className={field.value == null ? 'null' : undefined}>
                {formatValue(field.value)}
              </pre>
            </td>
            <td>
              <span className={`pill ${confidenceLevel(field.confidence)}`}>
                {field.confidence.toFixed(2)}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
