import { useState } from 'react'
import { DocumentPreview } from './components/DocumentPreview'
import { Hero } from './components/Hero'
import { PreviewDrawer } from './components/PreviewDrawer'
import { ResultPanel } from './components/ResultPanel'
import { SampleSelector } from './components/SampleSelector'
import { UploadPanel } from './components/UploadPanel'
import { extractDocument } from './lib/api'
import type { ExtractionResult } from './lib/types'

function App() {
  const [file, setFile] = useState<File | null>(null)
  const [sampleName, setSampleName] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ExtractionResult | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  function choose(next: File, sample: string | null) {
    setFile(next)
    setSampleName(sample)
    setResult(null)
    setError(null)
  }

  async function extract() {
    if (!file) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      setResult(await extractDocument(file))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Extraction failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main>
      <Hero />
      <section className="card">
        <h2>Choose a document</h2>
        <SampleSelector
          selected={sampleName}
          disabled={loading}
          onSelect={(sample, f) => {
            choose(f, sample.name)
            setDrawerOpen(true)
          }}
          onError={setError}
        />
        <UploadPanel
          disabled={loading}
          onFile={(f) => choose(f, null)}
          onReject={setError}
        />
        {file && (
          <div className="selected">
            <DocumentPreview key={file.name} file={file} className="selected-preview" />
            <span className="file-name">{file.name}</span>
          </div>
        )}
        <div className="extract-bar">
          <span>{file ? '' : 'No file selected'}</span>
          <button type="button" className="primary" disabled={!file || loading} onClick={extract}>
            {loading ? 'Extracting…' : 'Extract'}
          </button>
        </div>
      </section>
      {loading && <p className="status" role="status">Analysing document, this can take a few seconds…</p>}
      {error && <p className="status error" role="alert">{error}</p>}
      {drawerOpen && file && <PreviewDrawer file={file} onClose={() => setDrawerOpen(false)} />}
      {result && file && <ResultPanel result={result} fileName={file.name} />}
    </main>
  )
}

export default App
