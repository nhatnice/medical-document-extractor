import { useState } from 'react'
import type { ExtractionResult } from '../lib/types'

type Props = { result: ExtractionResult; fileName: string }

export function ResultActions({ result, fileName }: Props) {
  const [showing, setShowing] = useState(false)
  const json = JSON.stringify(result, null, 2)

  function download() {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${fileName.replace(/\.[^.]+$/, '')}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="actions">
        <button type="button" onClick={() => setShowing((s) => !s)}>
          {showing ? 'Hide JSON' : 'View JSON'}
        </button>
        <button type="button" onClick={download}>
          Download JSON
        </button>
      </div>
      {showing && <pre className="json">{json}</pre>}
    </div>
  )
}
