import { useEffect, useState } from 'react'
import { DocumentPreview } from './DocumentPreview'
import { SAMPLES, loadSample } from '../lib/samples'
import type { Sample } from '../lib/types'

type Props = {
  selected: string | null
  disabled: boolean
  onSelect: (sample: Sample, file: File) => void
  onError: (message: string) => void
}

function SampleCard({ sample, active, disabled, onSelect, onError }: {
  sample: Sample
  active: boolean
  disabled: boolean
  onSelect: Props['onSelect']
  onError: Props['onError']
}) {
  const [file, setFile] = useState<File | null>(null)

  useEffect(() => {
    loadSample(sample).then(setFile).catch((e) => onError(e instanceof Error ? e.message : 'Could not load sample'))
  }, [sample, onError])

  return (
    <button
      type="button"
      className={active ? 'sample active' : 'sample'}
      disabled={disabled || !file}
      onClick={() => file && onSelect(sample, file)}
    >
      {file ? <DocumentPreview file={file} /> : <div className="preview"><span className="preview-msg">Loading…</span></div>}
      <span className="sample-label">{sample.label}</span>
      <span className="sample-type">{sample.type.replace('_', ' ')}</span>
    </button>
  )
}

export function SampleSelector({ selected, disabled, onSelect, onError }: Props) {
  return (
    <ul className="samples">
      {SAMPLES.map((sample) => (
        <li key={sample.name}>
          <SampleCard
            sample={sample}
            active={sample.name === selected}
            disabled={disabled}
            onSelect={onSelect}
            onError={onError}
          />
        </li>
      ))}
    </ul>
  )
}
