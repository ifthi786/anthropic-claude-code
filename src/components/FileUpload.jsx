import { useState, useRef, useCallback } from 'react'

const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

/** Derive a lightweight checksum from ArrayBuffer content using SHA-256 via Web Crypto. */
async function computeChecksum(arrayBuffer) {
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer)
  const hashArray  = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

function formatBytes(bytes) {
  if (bytes < 1024)       return `${bytes} B`
  if (bytes < 1048576)    return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(2)} MB`
}

function formatDate(iso) {
  return new Date(iso).toLocaleString('en-AE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

/** Upload status values: idle | loading | success | error */

export default function FileUpload({
  id,
  title,
  description,
  accentColor = 'gold', // 'gold' | 'navy'
  currentFile,
  onUpload,
  onClear,
}) {
  const [status, setStatus]       = useState('idle')   // idle | loading | success | error
  const [errorMsg, setErrorMsg]   = useState('')
  const [dragActive, setDragActive] = useState(false)
  const inputRef = useRef(null)

  const isGold  = accentColor === 'gold'
  const ringCls = isGold ? 'ring-gold-500' : 'ring-navy-500'
  const iconBg  = isGold ? 'bg-gold-50 text-gold-500' : 'bg-navy-50 text-navy-500'

  const processFile = useCallback(
    async (file) => {
      setErrorMsg('')

      if (!file.name.endsWith('.xlsx')) {
        setStatus('error')
        setErrorMsg('Only .xlsx files are accepted.')
        return
      }
      if (file.size > MAX_SIZE_BYTES) {
        setStatus('error')
        setErrorMsg(`File exceeds the 10 MB limit (${formatBytes(file.size)}).`)
        return
      }

      setStatus('loading')

      try {
        const buffer   = await file.arrayBuffer()
        const checksum = await computeChecksum(buffer)

        const meta = {
          name:       file.name,
          size:       file.size,
          sizeLabel:  formatBytes(file.size),
          uploadedAt: new Date().toISOString(),
          checksum,
        }

        onUpload(meta)
        setStatus('success')
      } catch {
        setStatus('error')
        setErrorMsg('Failed to process the file. Please try again.')
      }
    },
    [onUpload]
  )

  function handleInputChange(e) {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    e.target.value = ''
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragActive(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }

  function handleDragOver(e) {
    e.preventDefault()
    setDragActive(true)
  }

  function handleDragLeave() {
    setDragActive(false)
  }

  function handleClear() {
    setStatus('idle')
    setErrorMsg('')
    onClear()
  }

  return (
    <div className="card flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className={`p-2.5 rounded-xl ${iconBg}`}>
          <UploadIcon />
        </div>
        <div>
          <h3 className="font-semibold text-slate-800 text-base leading-tight">{title}</h3>
          <p className="text-slate-500 text-sm mt-0.5">{description}</p>
        </div>
      </div>

      {/* Current file badge */}
      {currentFile && (
        <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <XlsxIcon />
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">{currentFile.name}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {currentFile.sizeLabel} · Uploaded {formatDate(currentFile.uploadedAt)}
              </p>
              <p className="text-xs text-slate-400 font-mono mt-0.5 truncate">
                SHA-256: {currentFile.checksum.slice(0, 16)}…
              </p>
            </div>
          </div>
          <button
            onClick={handleClear}
            title="Remove file"
            className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <TrashIcon />
          </button>
        </div>
      )}

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        className={[
          'relative border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3',
          'cursor-pointer transition-all duration-150 select-none',
          dragActive
            ? `dropzone-active ${ringCls}`
            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50',
          status === 'loading' ? 'pointer-events-none opacity-60' : '',
        ].join(' ')}
      >
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
          onChange={handleInputChange}
        />

        {status === 'loading' ? (
          <LoadingSpinner />
        ) : (
          <CloudUploadIcon className={isGold ? 'text-gold-400' : 'text-navy-400'} />
        )}

        <div className="text-center">
          <p className="text-sm font-medium text-slate-700">
            {status === 'loading' ? 'Processing file…' : 'Drop your file here, or click to browse'}
          </p>
          <p className="text-xs text-slate-400 mt-1">.xlsx only · max 10 MB</p>
        </div>
      </div>

      {/* Status messages */}
      {status === 'success' && (
        <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5">
          <CheckIcon />
          File uploaded and stored successfully.
        </div>
      )}

      {status === 'error' && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
          <AlertIcon />
          {errorMsg}
        </div>
      )}
    </div>
  )
}

/* ─── Inline icon components ──────────────────────────────────────────── */

function UploadIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12
           3m0 0 4.5 4.5M12 3v13.5"
      />
    </svg>
  )
}

function CloudUploadIcon({ className }) {
  return (
    <svg className={`w-10 h-10 ${className}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0
           1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z"
      />
    </svg>
  )
}

function XlsxIcon() {
  return (
    <div className="shrink-0 w-9 h-9 bg-emerald-50 rounded-lg flex items-center justify-center">
      <span className="text-[10px] font-bold text-emerald-600 tracking-tight">XLSX</span>
    </div>
  )
}

function TrashIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16
           19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456
           0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11
           0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32
           0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
      />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
  )
}

function AlertIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874
           1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
      />
    </svg>
  )
}

function LoadingSpinner() {
  return (
    <svg className="w-10 h-10 text-gold-500 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z"
      />
    </svg>
  )
}
