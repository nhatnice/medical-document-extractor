import { useRef } from 'react'

type Props = {
  disabled: boolean
  onFile: (file: File) => void
  onReject: (message: string) => void
}

// Matches the formats the server accepts.
const ACCEPTED = /^(application\/pdf|image\/(png|jpeg|webp))$/
const MAX_BYTES = 20 * 1024 * 1024

export function UploadPanel({ disabled, onFile, onReject }: Props) {
  const input = useRef<HTMLInputElement>(null)

  function handle(file: File | undefined) {
    if (!file) return
    if (!ACCEPTED.test(file.type)) {
      onReject('Only PDF, PNG, JPEG or WEBP files are accepted.')
      return
    }
    if (file.size > MAX_BYTES) {
      onReject('File exceeds 20 MB.')
      return
    }
    onFile(file)
  }

  return (
    <div
      className="upload"
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={() => !disabled && input.current?.click()}
      onKeyDown={(e) => {
        if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          input.current?.click()
        }
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        if (!disabled) handle(e.dataTransfer.files[0])
      }}
    >
      <p>Click or drop a PDF / image here</p>
      <input
        ref={input}
        type="file"
        hidden
        accept="application/pdf,image/png,image/jpeg,image/webp"
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          handle(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </div>
  )
}
