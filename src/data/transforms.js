/**
 * Pure utility functions for transforming parsed benchmark data.
 * All functions are side-effect-free and take/return plain objects.
 */

// ─── Formatting ───────────────────────────────────────────────────────────────

/** Format an AED amount with thousands separator and 2 dp. */
export function formatAED(value, { showUnit = true } = {}) {
  if (value === null || value === undefined || isNaN(value)) return '—'
  const formatted = new Intl.NumberFormat('en-AE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
  return showUnit ? `AED ${formatted}` : formatted
}

/** Format a normalised key (UPPER_SNAKE_CASE) into a readable label. */
export function toLabel(key) {
  if (!key) return ''
  return key
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase())
}

/** Format a price index number (e.g. 2.84 → "2.84×"). */
export function formatIndex(index) {
  if (index === null || index === undefined || isNaN(index)) return '—'
  return `${Number(index).toFixed(2)}×`
}

// ─── Data transforms ──────────────────────────────────────────────────────────

/**
 * Group an array of items by a key getter.
 * @template T
 * @param {T[]} items
 * @param {(item: T) => string} getKey
 * @returns {Record<string, T[]>}
 */
export function groupBy(items, getKey) {
  return items.reduce((acc, item) => {
    const key = getKey(item)
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {})
}

/**
 * Sort benchmark rows by a numeric field (descending by default).
 * @param {Benchmark[]} rows
 * @param {'avgRate'|'minRate'|'maxRate'|'priceIndex'|'occurrences'} field
 * @param {'asc'|'desc'} direction
 * @returns {Benchmark[]}
 */
export function sortBenchmarks(rows, field = 'avgRate', direction = 'desc') {
  return [...rows].sort((a, b) => {
    const av = a[field] ?? -Infinity
    const bv = b[field] ?? -Infinity
    return direction === 'desc' ? bv - av : av - bv
  })
}

/**
 * Produce a pivot table: category rows × location columns, values = avgRate.
 * @param {Benchmark[]} benchmarks
 * @returns {{ categories: string[], locations: string[], matrix: (number|null)[][] }}
 */
export function buildRateMatrix(benchmarks) {
  const categories = [...new Set(benchmarks.map(b => b.category))].sort()
  const locations  = [...new Set(benchmarks.map(b => b.normLocation))].sort()

  const lookup = new Map(benchmarks.map(b => [`${b.category}|${b.normLocation}`, b.avgRate]))

  const matrix = categories.map(cat =>
    locations.map(loc => lookup.get(`${cat}|${loc}`) ?? null)
  )

  return { categories, locations, matrix }
}

/**
 * Compute a simple price-flag distribution from the location layer.
 * @param {Item[]} locationLayer
 * @returns {Record<string, number>}
 */
export function getPriceFlagDistribution(locationLayer) {
  return locationLayer.reduce((acc, item) => {
    const flag = item.priceFlag || 'Unknown'
    acc[flag] = (acc[flag] ?? 0) + 1
    return acc
  }, {})
}

/**
 * Compute per-project summary statistics from the location layer.
 * @param {Item[]} locationLayer
 * @returns {ProjectSummary[]}
 */
export function buildProjectSummaries(locationLayer) {
  const groups = groupBy(locationLayer, r => r.project)

  return Object.entries(groups).map(([project, items]) => {
    const rates = items.map(i => i.rate).filter(r => r !== null)
    const flags = getPriceFlagDistribution(items)

    return {
      project,
      itemCount:  items.length,
      avgRate:    rates.length ? rates.reduce((s, v) => s + v, 0) / rates.length : null,
      minRate:    rates.length ? Math.min(...rates) : null,
      maxRate:    rates.length ? Math.max(...rates) : null,
      categories: [...new Set(items.map(i => i.category))],
      flags,
    }
  })
}

/**
 * Compare a single submitted rate against a benchmark row.
 * Returns a deviation percentage and a qualitative band.
 * @param {number} submittedRate
 * @param {{ avgRate: number, minRate: number, maxRate: number }} benchmark
 * @returns {RateComparison}
 */
export function compareRate(submittedRate, benchmark) {
  if (submittedRate === null || !benchmark?.avgRate) {
    return { deviation: null, band: 'unknown', withinRange: null }
  }

  const deviation = ((submittedRate - benchmark.avgRate) / benchmark.avgRate) * 100
  const withinRange = submittedRate >= benchmark.minRate && submittedRate <= benchmark.maxRate

  let band
  if (deviation <= -20)      band = 'very_low'
  else if (deviation <= -5)  band = 'low'
  else if (deviation <= 5)   band = 'market'
  else if (deviation <= 20)  band = 'high'
  else                       band = 'very_high'

  return { deviation: Math.round(deviation * 10) / 10, band, withinRange }
}

/**
 * Band label → Tailwind colour class (for UI rendering).
 * @param {string} band
 * @returns {{ bg: string, text: string, border: string }}
 */
export function bandColour(band) {
  const map = {
    very_low:  { bg: 'bg-blue-50',    text: 'text-blue-700',   border: 'border-blue-200'  },
    low:       { bg: 'bg-emerald-50', text: 'text-emerald-700',border: 'border-emerald-200'},
    market:    { bg: 'bg-green-50',   text: 'text-green-700',  border: 'border-green-200' },
    high:      { bg: 'bg-amber-50',   text: 'text-amber-700',  border: 'border-amber-200' },
    very_high: { bg: 'bg-red-50',     text: 'text-red-700',    border: 'border-red-200'   },
    unknown:   { bg: 'bg-slate-50',   text: 'text-slate-500',  border: 'border-slate-200' },
  }
  return map[band] ?? map.unknown
}

/**
 * Filter benchmark rows to those with sufficient data for reliable comparison.
 * @param {Benchmark[]} benchmarks
 * @param {number} minOccurrences  minimum datapoints to be considered reliable
 * @returns {Benchmark[]}
 */
export function filterReliable(benchmarks, minOccurrences = 2) {
  return benchmarks.filter(b => b.occurrences >= minOccurrences)
}
