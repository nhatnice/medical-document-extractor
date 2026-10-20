import { useRef } from 'react'

type Props = {
  disabled: boolean
  onFile: (file: File) => void
  onReject: (message: string) => void
}

const ACCEPTED = /^(application\/pdf|image\/.+)$/

export function UploadPanel({ disabled, onFile, onReject }: Props) {
  const input = useRef<HTMLInputElement>(null)

  function handle(file: File | undefined) {
    if (!file) return
    if (!ACCEPTED.test(file.type)) {
      onReject('Only PDF or image files are accepted.')
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
        accept="application/pdf,image/*"
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          handle(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </div>
  )
}
