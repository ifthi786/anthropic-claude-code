import { createContext, useContext, useState, useEffect } from 'react'
import { ExcelParser, BenchmarkStore, DataValidator } from '../data'
import { saveBenchmarkData, loadBenchmarkData, clearBenchmarkData } from '../data/storage'
import { BOQParser, DeviationAnalyzer, ReportGenerator } from '../analysis'
import {
  saveAnalysis,
  loadCurrentAnalysis,
  clearCurrentAnalysis,
  getAnalysisContext,
} from '../analysis/StorageManager'

const AppContext = createContext(null)
const FILE_META_KEY = 'aldar_procurement_files'

export function AppProvider({ children }) {
  // ── File metadata ──────────────────────────────────────────────────────────
  const [benchmarkFile, setBenchmarkFile] = useState(null)
  const [projectFile,   setProjectFile]   = useState(null)

  // ── Benchmark layer ────────────────────────────────────────────────────────
  const [benchmarkData,  setBenchmarkData]  = useState(null)
  const [benchmarkStore, setBenchmarkStore] = useState(null)
  const [validation,     setValidation]     = useState(null)

  // ── Analysis layer ─────────────────────────────────────────────────────────
  const [analysisReport,  setAnalysisReport]  = useState(null)
  const [analysisContext, setAnalysisContext] = useState(null)

  // ── Async state ────────────────────────────────────────────────────────────
  const [parsing,        setParsing]        = useState(false)
  const [analysingBOQ,   setAnalysingBOQ]   = useState(false)
  const [parseError,     setParseError]     = useState(null)
  const [analysisError,  setAnalysisError]  = useState(null)

  // ── Restore from localStorage on mount ────────────────────────────────────
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(FILE_META_KEY) || '{}')
      if (stored.benchmark) setBenchmarkFile(stored.benchmark)
      if (stored.project)   setProjectFile(stored.project)
    } catch { /* ignore */ }

    const cached = loadBenchmarkData()
    if (cached?.data) {
      try {
        const store  = new BenchmarkStore(cached.data)
        const report = DataValidator.validate(cached.data)
        setBenchmarkData(cached.data)
        setBenchmarkStore(store)
        setValidation(report)

        // Restore latest analysis if benchmark is compatible
        const saved = loadCurrentAnalysis()
        if (saved?.report) {
          setAnalysisReport(saved.report)
          setAnalysisContext(getAnalysisContext(saved.report, store))
        }
      } catch { /* stale cache */ }
    }
  }, [])

  // ── File metadata helpers ──────────────────────────────────────────────────
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
      setAnalysisReport(null)
      setAnalysisContext(null)
      clearBenchmarkData()
      clearCurrentAnalysis()
    }
    if (key === 'project') {
      setProjectFile(null)
      setAnalysisReport(null)
      setAnalysisContext(null)
      setAnalysisError(null)
      clearCurrentAnalysis()
    }
    const stored = JSON.parse(localStorage.getItem(FILE_META_KEY) || '{}')
    delete stored[key]
    localStorage.setItem(FILE_META_KEY, JSON.stringify(stored))
  }

  // ── Benchmark upload ───────────────────────────────────────────────────────
  async function handleBenchmarkUpload(meta, file) {
    setBenchmarkFile(meta)
    _persistFileMeta('benchmark', meta)
    setParseError(null)
    if (!file) return

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
        setParseError(`Parsed OK but could not cache: ${saveResult.error}`)
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

  // ── Project quotation upload + analysis ────────────────────────────────────
  async function handleProjectUpload(meta, file) {
    setProjectFile(meta)
    _persistFileMeta('project', meta)
    setAnalysisError(null)
    setAnalysisReport(null)
    setAnalysisContext(null)

    if (!file || !benchmarkStore) return

    setAnalysingBOQ(true)
    try {
      // 1. Parse BOQ
      const boqResult = await BOQParser.parse(file)
      if (!boqResult.items.length) {
        throw new Error(
          boqResult.warnings.length
            ? boqResult.warnings[0]
            : 'No parseable items found in the uploaded BOQ file.'
        )
      }

      // 2. Deviation analysis
      const analyzer  = new DeviationAnalyzer(benchmarkStore)
      const results   = analyzer.analyseAll(boqResult.items)

      // 3. Report
      const report = ReportGenerator.generate(results, boqResult, {
        name:         meta.name,
        uploadedAt:   meta.uploadedAt,
        fileMetadata: meta,
      })

      setAnalysisReport(report)
      setAnalysisContext(getAnalysisContext(report, benchmarkStore))

      // 4. Persist
      const saveResult = saveAnalysis(report)
      if (!saveResult.success) {
        setAnalysisError(`Analysis complete but could not be saved: ${saveResult.error}`)
      }
    } catch (e) {
      setAnalysisError(e.message ?? 'Failed to analyse project file.')
    } finally {
      setAnalysingBOQ(false)
    }
  }

  return (
    <AppContext.Provider
      value={{
        benchmarkFile, projectFile,
        benchmarkData, benchmarkStore, validation,
        analysisReport, analysisContext,
        parsing, analysingBOQ, parseError, analysisError,
        handleBenchmarkUpload, handleProjectUpload, clearFile,
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
