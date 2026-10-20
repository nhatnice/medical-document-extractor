export const ZOOM_MIN = 0.5
export const ZOOM_MAX = 3
const ZOOM_STEP = 0.25

type Props = { zoom: number; onChange: (zoom: number) => void }

export function ZoomControls({ zoom, onChange }: Props) {
  const clamp = (value: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value))

  return (
    <div className="zoom-controls">
      <button type="button" aria-label="Zoom out" disabled={zoom <= ZOOM_MIN} onClick={() => onChange(clamp(zoom - ZOOM_STEP))}>
        −
      </button>
      <span className="zoom-level">{Math.round(zoom * 100)}%</span>
      <button type="button" aria-label="Zoom in" disabled={zoom >= ZOOM_MAX} onClick={() => onChange(clamp(zoom + ZOOM_STEP))}>
        +
      </button>
      <button type="button" aria-label="Reset zoom" disabled={zoom === 1} onClick={() => onChange(1)}>
        Reset
      </button>
    </div>
  )
}
