import { useEffect, useState } from 'react'
import { DocumentPreview } from './DocumentPreview'
import { ZoomControls } from './ZoomControls'

type Props = { file: File; onClose: () => void }

// Side panel, not a modal: no backdrop, so the results below stay visible for comparison.
export function PreviewDrawer({ file, onClose }: Props) {
  const [zoom, setZoom] = useState(1)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <aside className="drawer" role="dialog" aria-label={file.name}>
      <div className="drawer-header">
        <span className="file-name">{file.name}</span>
        <button type="button" aria-label="Close preview" onClick={onClose}>
          ×
        </button>
      </div>
      <ZoomControls zoom={zoom} onChange={setZoom} />
      <div className="drawer-body">
        <DocumentPreview
          key={file.name}
          file={file}
          width={1200}
          className="drawer-preview"
          style={{ width: `${zoom * 100}%` }}
        />
      </div>
    </aside>
  )
}
