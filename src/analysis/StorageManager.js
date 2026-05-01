/**
 * StorageManager
 * Persists analysis results to localStorage with history tracking.
 *
 * Storage keys:
 *   aldar_analysis_current   – latest AnalysisReport (full, including _results)
 *   aldar_analysis_history   – Array<HistoryEntry> (metadata + summary only, no _results)
 *
 * History entries are capped to MAX_HISTORY items (oldest removed first).
 */

const KEY_CURRENT  = 'aldar_analysis_current'
const KEY_HISTORY  = 'aldar_analysis_history'
const FORMAT_VER   = 1
const MAX_HISTORY  = 20

// ─── Internal helpers ─────────────────────────────────────────────────────────

function wrap(payload) {
  return JSON.stringify({ _v: FORMAT_VER, ...payload })
}

function unwrap(raw) {
  try {
    const p = JSON.parse(raw)
    if (!p || p._v !== FORMAT_VER) return null
    return p
  } catch {
    return null
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, value)
    return { success: true }
  } catch (e) {
    const msg = e?.name === 'QuotaExceededError'
      ? 'localStorage quota exceeded — consider clearing analysis history.'
      : `Storage error: ${e?.message ?? 'unknown'}`
    return { success: false, error: msg }
  }
}

/**
 * Build a lightweight history entry (no per-item results data).
 */
function toHistoryEntry(report, id) {
  return {
    id,
    generatedAt:   report.generatedAt,
    projectName:   report.projectMeta?.name ?? 'Unnamed Project',
    fileMetadata:  report.projectMeta?.fileMetadata ?? null,
    summary:       report.summary,
    financials:    report.financials,
    flagCounts:    report.flagCounts,
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Save the current analysis report and append a summary entry to history.
 *
 * @param {AnalysisReport} report   Output of ReportGenerator.generate()
 * @returns {{ success: boolean, id?: string, error?: string }}
 */
export function saveAnalysis(report) {
  const id = `analysis_${Date.now()}`

  // Persist full report (strip _results for storage to save space)
  const storageReport = { ...report, _results: undefined }
  const currentResult = safeSet(KEY_CURRENT, wrap({ id, report: storageReport }))
  if (!currentResult.success) return currentResult

  // Append to history
  const history = loadAnalysisHistory()
  const entry   = toHistoryEntry(report, id)
  history.unshift(entry)
  const trimmed = history.slice(0, MAX_HISTORY)

  const histResult = safeSet(KEY_HISTORY, wrap({ entries: trimmed }))
  if (!histResult.success) {
    // Current was saved; history append failed — non-critical
    return { success: true, id, warning: histResult.error }
  }

  return { success: true, id }
}

/**
 * Load the most recently saved analysis report.
 * @returns {{ id: string, report: AnalysisReport } | null}
 */
export function loadCurrentAnalysis() {
  const raw = localStorage.getItem(KEY_CURRENT)
  if (!raw) return null
  const p = unwrap(raw)
  if (!p?.report) {
    localStorage.removeItem(KEY_CURRENT)
    return null
  }
  return { id: p.id, report: p.report }
}

/**
 * Load history entries (metadata + summaries, no per-item data).
 * @returns {HistoryEntry[]}
 */
export function loadAnalysisHistory() {
  const raw = localStorage.getItem(KEY_HISTORY)
  if (!raw) return []
  const p = unwrap(raw)
  return Array.isArray(p?.entries) ? p.entries : []
}

/**
 * Remove the current analysis from storage.
 */
export function clearCurrentAnalysis() {
  localStorage.removeItem(KEY_CURRENT)
}

/**
 * Remove all history entries.
 */
export function clearAnalysisHistory() {
  localStorage.removeItem(KEY_HISTORY)
}

/**
 * Export the current analysis as a downloadable JSON blob.
 * Returns a URL to the blob (caller is responsible for revoking it).
 * @param {AnalysisReport} report
 * @returns {string}  Object URL
 */
export function exportAnalysisJSON(report) {
  // Strip internal _results to keep export lean
  const exportData = { ...report, _results: undefined }
  const json = JSON.stringify(exportData, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  return URL.createObjectURL(blob)
}

/**
 * Build a structured context object for the chatbot.
 * Contains enough signal for the AI to narrate findings without overwhelming it.
 *
 * @param {AnalysisReport | null} report
 * @param {import('../data/BenchmarkStore').BenchmarkStore | null} store
 * @returns {ChatbotContext}
 */
export function getAnalysisContext(report, store) {
  if (!report) {
    return {
      hasAnalysis:  false,
      hasBenchmark: !!store,
      message:      store
        ? 'Benchmark data is loaded but no BOQ has been analysed yet.'
        : 'Neither benchmark data nor a project BOQ has been loaded.',
    }
  }

  const { summary, financials, flagCounts, byCategory, topOffenders, unmatchedItems, narrative } = report

  return {
    hasAnalysis:   true,
    hasBenchmark:  true,
    projectName:   report.projectMeta?.name ?? 'Unknown Project',
    generatedAt:   report.generatedAt,
    narrative,

    // Summary numbers
    summary: {
      totalItems:    summary.totalItems,
      matchRate:     summary.matchRate,
      flaggedItems:  summary.flaggedItems,
      flagRate:      summary.flagRate,
    },

    // Financial snapshot
    financials: {
      totalBOQValue:   financials.totalBOQValue,
      overpaymentAED:  financials.overpaymentAED,
      underpaymentAED: financials.underpaymentAED,
      netVarianceAED:  financials.netVarianceAED,
    },

    // Flag counts
    flags: flagCounts,

    // Top 5 categories by overpayment (trimmed for context window)
    topCategories: byCategory.slice(0, 5).map(c => ({
      category:    c.category,
      label:       c.label,
      itemCount:   c.itemCount,
      avgDeviation: c.avgDeviation,
      overpayAED:  c.overpayAED,
      worstFlag:   c.worstFlag,
    })),

    // Top 5 offenders (trimmed)
    topOffenders: topOffenders.slice(0, 5).map(r => ({
      description:  r.item.description,
      rate:         r.item.rate,
      quantity:     r.item.quantity,
      benchmarkAvg: r.benchmark?.avgRate ?? null,
      deviation:    r.deviation,
      flag:         r.flag,
      reasoning:    r.reasoning,
    })),

    // All per-item reasonings (for detailed chatbot Q&A)
    itemReasonings: (report._results ?? []).map(r => ({
      itemId:      r.item.itemId,
      description: r.item.description,
      flag:        r.flag,
      deviation:   r.deviation,
      reasoning:   r.reasoning,
    })),

    unmatchedCount: unmatchedItems.length,
    unmatchedItems: unmatchedItems.slice(0, 10),

    // Store meta
    benchmark: store ? {
      categories: store.getCategories(),
      projects:   store.getProjects(),
      locations:  store.getLocations(),
    } : null,
  }
}
