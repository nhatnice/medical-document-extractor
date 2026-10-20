import { useEffect, useState, type CSSProperties } from 'react'
import { renderFirstPage } from '../lib/pdf'

type Props = { file: Blob; className?: string; width?: number; style?: CSSProperties }

// Shows the first page of a PDF, or the image itself. Fills a fixed-size box set by the parent.
export function DocumentPreview({ file, className, width = 400, style }: Props) {
  const [src, setSrc] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    let objectUrl: string | null = null

    const load =
      file.type === 'application/pdf'
        ? renderFirstPage(file, width)
        : Promise.resolve((objectUrl = URL.createObjectURL(file)))

    load
      .then((url) => {
        if (!cancelled) setSrc(url)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [file, width])

  return (
    <div className={`preview ${className ?? ''}`} style={style}>
      {failed && <span className="preview-msg">No preview</span>}
      {!failed && !src && <span className="preview-msg">Loading…</span>}
      {src && <img src={src} alt="Document preview" />}
    </div>
  )
}
