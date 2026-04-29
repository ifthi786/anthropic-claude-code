import { createContext, useContext, useState, useEffect } from 'react'
import { ExcelParser, BenchmarkStore, DataValidator } from '../data'
import {
  saveBenchmarkData,
  loadBenchmarkData,
  clearBenchmarkData,
  getBenchmarkCacheInfo,
} from '../data/storage'

const AppContext = createContext(null)

const FILE_META_KEY = 'aldar_procurement_files'

export function AppProvider({ children }) {
  // File metadata (filename, size, checksum, uploadedAt)
  const [benchmarkFile, setBenchmarkFile] = useState(null)
  const [projectFile,   setProjectFile]   = useState(null)

  // Parsed data + derived objects
  const [benchmarkData,  setBenchmarkData]  = useState(null) // raw ParsedData
  const [benchmarkStore, setBenchmarkStore] = useState(null) // BenchmarkStore instance
  const [validation,     setValidation]     = useState(null) // ValidationReport

  // Async parse state
  const [parsing,    setParsing]    = useState(false)
  const [parseError, setParseError] = useState(null)

  // ── Restore from localStorage on mount ─────────────────────────────────────
  useEffect(() => {
    // Restore file metadata
    try {
      const stored = JSON.parse(localStorage.getItem(FILE_META_KEY) || '{}')
      if (stored.benchmark) setBenchmarkFile(stored.benchmark)
      if (stored.project)   setProjectFile(stored.project)
    } catch { /* ignore */ }

    // Restore parsed benchmark data
    const cached = loadBenchmarkData()
    if (cached?.data) {
      try {
        const store   = new BenchmarkStore(cached.data)
        const report  = DataValidator.validate(cached.data)
        setBenchmarkData(cached.data)
        setBenchmarkStore(store)
        setValidation(report)
      } catch { /* stale cache — ignore */ }
    }
  }, [])

  // ── File metadata persistence ───────────────────────────────────────────────
  function _persistFileMeta(key, meta) {
    const stored = JSON.parse(localStorage.getItem(FILE_META_KEY) || '{}')
    stored[key] = meta
    localStorage.setItem(FILE_META_KEY, JSON.stringify(stored))
  }

  function clearFile(key) {
    if (key === 'benchmark') {
      setBenchmarkFile(null)
      setBenchmarkData(null)
      setBenchmarkStore(null)
      setValidation(null)
      setParseError(null)
      clearBenchmarkData()
    }
    if (key === 'project') setProjectFile(null)

    const stored = JSON.parse(localStorage.getItem(FILE_META_KEY) || '{}')
    delete stored[key]
    localStorage.setItem(FILE_META_KEY, JSON.stringify(stored))
  }

  // ── Benchmark upload: parse + store + persist ───────────────────────────────
  async function handleBenchmarkUpload(meta, file) {
    setBenchmarkFile(meta)
    _persistFileMeta('benchmark', meta)
    setParseError(null)

    if (!file) return // called from cache restore — no File object available

    setParsing(true)
    try {
      const parsed  = await ExcelParser.parse(file)
      const store   = new BenchmarkStore(parsed)
      const report  = DataValidator.validate(parsed)

      setBenchmarkData(parsed)
      setBenchmarkStore(store)
      setValidation(report)

      const saveResult = saveBenchmarkData(parsed, meta)
      if (!saveResult.success) {
        // Data is still in memory; warn but don't fail
        setParseError(`Data parsed successfully but could not be cached: ${saveResult.error}`)
      }
    } catch (e) {
      setParseError(e.message ?? 'Failed to parse benchmark file.')
      setBenchmarkData(null)
      setBenchmarkStore(null)
      setValidation(null)
    } finally {
      setParsing(false)
    }
  }

  // ── Project quotation upload ────────────────────────────────────────────────
  function handleProjectUpload(meta) {
    setProjectFile(meta)
    _persistFileMeta('project', meta)
  }

  return (
    <AppContext.Provider
      value={{
        // File metadata
        benchmarkFile,
        projectFile,
        // Parsed data
        benchmarkData,
        benchmarkStore,
        validation,
        // Async state
        parsing,
        parseError,
        // Actions
        handleBenchmarkUpload,
        handleProjectUpload,
        clearFile,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}
