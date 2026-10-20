export type ConfidenceLevel = 'high' | 'medium' | 'low'

export function confidenceLevel(value: number): ConfidenceLevel {
  if (value >= 0.85) return 'high'
  if (value >= 0.5) return 'medium'
  return 'low'
}
