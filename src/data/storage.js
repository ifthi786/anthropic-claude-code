/**
 * localStorage helpers for persisting benchmark data.
 *
 * Keys:
 *   aldar_benchmark_data   – JSON-serialised ParsedData + metadata
 *
 * Layout of stored value:
 *   { data: ParsedData, timestamp: ISO string, fileMetadata: FileMeta }
 */

const STORAGE_KEY = 'aldar_benchmark_data'
const FORMAT_VERSION = 1

// ─── Serialise / deserialise ──────────────────────────────────────────────────

function serialise(payload) {
  return JSON.stringify({ _v: FORMAT_VERSION, ...payload })
}

function deserialise(raw) {
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || parsed._v !== FORMAT_VERSION) return null
    return parsed
  } catch {
    return null
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Persist parsed benchmark data alongside a timestamp and optional file metadata.
 * @param {ParsedData} data      The object returned by ExcelParser.parse()
 * @param {FileMeta}   [fileMeta] Optional metadata from the FileUpload component
 * @returns {{ success: boolean, error?: string }}
 */
export function saveBenchmarkData(data, fileMeta = null) {
  try {
    const payload = serialise({
      data,
      timestamp: new Date().toISOString(),
      fileMeta,
    })
    localStorage.setItem(STORAGE_KEY, payload)
    return { success: true }
  } catch (e) {
    // Most likely QuotaExceededError
    const message = e?.name === 'QuotaExceededError'
      ? 'localStorage quota exceeded — the benchmark file is too large to cache.'
      : `Failed to save benchmark data: ${e?.message ?? 'unknown error'}`
    return { success: false, error: message }
  }
}

/**
 * Load previously saved benchmark data.
 * @returns {{ data: ParsedData, timestamp: string, fileMeta: FileMeta } | null}
 */
export function loadBenchmarkData() {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  const stored = deserialise(raw)
  if (!stored) {
    // Corrupt or old-version entry — remove it
    localStorage.removeItem(STORAGE_KEY)
    return null
  }
  return { data: stored.data, timestamp: stored.timestamp, fileMeta: stored.fileMeta }
}

/**
 * Remove cached benchmark data.
 */
export function clearBenchmarkData() {
  localStorage.removeItem(STORAGE_KEY)
}

/**
 * Return basic info about what's currently cached (without deserialising the full data).
 * @returns {{ cached: boolean, timestamp?: string, fileMeta?: object }}
 */
export function getBenchmarkCacheInfo() {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return { cached: false }
  const stored = deserialise(raw)
  if (!stored) return { cached: false }
  return {
    cached:    true,
    timestamp: stored.timestamp,
    fileMeta:  stored.fileMeta,
  }
}

/**
 * Estimate the byte size of the cached entry (useful for UI display).
 * @returns {number} bytes, or 0 if nothing is cached
 */
export function getBenchmarkCacheSize() {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return 0
  // JS strings are UTF-16 internally; localStorage stores as UTF-16 → 2 bytes/char
  return raw.length * 2
}
