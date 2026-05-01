/**
 * DeviationAnalyzer
 * Compares each matched BOQ item against its benchmark and classifies the deviation.
 *
 * Flag thresholds (per specification):
 *   deviation > +30%              → Overpriced       (RED)
 *   +15% ≤ deviation ≤ +30%      → Slightly_Expensive (YELLOW)
 *   -15% ≤ deviation ≤ +15%      → Competitive       (GREEN)
 *   deviation < -15%              → Underpriced       (BLUE)
 *
 * Every result carries a `reasoning` string so the chatbot can narrate it.
 */

import { BenchmarkMatcher } from './BenchmarkMatcher'

// ─── Constants ────────────────────────────────────────────────────────────────

export const FLAG = {
  OVERPRICED:          'Overpriced',
  SLIGHTLY_EXPENSIVE:  'Slightly_Expensive',
  COMPETITIVE:         'Competitive',
  UNDERPRICED:         'Underpriced',
}

export const FLAG_COLOR = {
  [FLAG.OVERPRICED]:         'red',
  [FLAG.SLIGHTLY_EXPENSIVE]: 'yellow',
  [FLAG.COMPETITIVE]:        'green',
  [FLAG.UNDERPRICED]:        'blue',
}

// Tailwind class sets for each flag
export const FLAG_TAILWIND = {
  [FLAG.OVERPRICED]:         { bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200',    dot: 'bg-red-500'    },
  [FLAG.SLIGHTLY_EXPENSIVE]: { bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200',  dot: 'bg-amber-500'  },
  [FLAG.COMPETITIVE]:        { bg: 'bg-emerald-50', text: 'text-emerald-700',border: 'border-emerald-200',dot: 'bg-emerald-500'},
  [FLAG.UNDERPRICED]:        { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200',   dot: 'bg-blue-500'   },
}

const THRESHOLDS = {
  OVERPRICED:         +30,   // > +30%
  SLIGHTLY_EXPENSIVE: +15,   // > +15%
  UNDERPRICED:        -15,   // < -15%
}

// Minimum occurrences for a benchmark to be considered statistically reliable
const MIN_RELIABLE_OCCURRENCES = 2

// ─── Helpers ──────────────────────────────────────────────────────────────────

function roundDp(n, dp = 1) {
  return Math.round(n * 10 ** dp) / 10 ** dp
}

/**
 * Classify deviation% into a FLAG constant.
 */
function classifyDeviation(deviationPct) {
  if (deviationPct > THRESHOLDS.OVERPRICED)         return FLAG.OVERPRICED
  if (deviationPct > THRESHOLDS.SLIGHTLY_EXPENSIVE) return FLAG.SLIGHTLY_EXPENSIVE
  if (deviationPct < THRESHOLDS.UNDERPRICED)        return FLAG.UNDERPRICED
  return FLAG.COMPETITIVE
}

/**
 * Position of `rate` within the benchmark [min, max] range, expressed as 0–100.
 * Returns values outside 0–100 when the rate is beyond the observed range.
 */
function calcPercentile(rate, minRate, maxRate) {
  if (minRate === null || maxRate === null) return null
  if (maxRate === minRate) return rate <= minRate ? 0 : 100
  return roundDp(((rate - minRate) / (maxRate - minRate)) * 100, 1)
}

/**
 * Build the reasoning string for chatbot consumption.
 */
function buildReasoning(item, matchResult, benchmark, metrics) {
  const { category, confidence } = matchResult
  const { deviation, flag, percentile, withinRange } = metrics

  const confLabel = BenchmarkMatcher.confidenceLabel(confidence)
  const benchRef  = benchmark ? `benchmark avg of AED ${benchmark.avgRate?.toFixed(2) ?? '?'}` : 'no benchmark'
  const rangeNote = benchmark
    ? `observed market range AED ${benchmark.minRate?.toFixed(2) ?? '?'} – ${benchmark.maxRate?.toFixed(2) ?? '?'}`
    : ''
  const reliabilityNote = benchmark && benchmark.occurrences < MIN_RELIABLE_OCCURRENCES
    ? ` Note: benchmark is based on only ${benchmark.occurrences} datapoint(s) — treat with caution.`
    : ''

  const deviationStr = deviation > 0
    ? `${deviation.toFixed(1)}% above`
    : `${Math.abs(deviation).toFixed(1)}% below`

  let flagExplanation
  switch (flag) {
    case FLAG.OVERPRICED:
      flagExplanation = `The rate is ${deviationStr} the ${benchRef}, which exceeds the +30% threshold and is classified as OVERPRICED (red). This represents a significant cost exposure.`
      break
    case FLAG.SLIGHTLY_EXPENSIVE:
      flagExplanation = `The rate is ${deviationStr} the ${benchRef}, falling in the +15–30% band and classified as SLIGHTLY EXPENSIVE (yellow). Consider negotiating this item.`
      break
    case FLAG.COMPETITIVE:
      flagExplanation = `The rate is ${deviationStr} the ${benchRef}, within the ±15% competitive band and classified as COMPETITIVE (green). This rate is acceptable.`
      break
    case FLAG.UNDERPRICED:
      flagExplanation = `The rate is ${deviationStr} the ${benchRef}, which is more than 15% below benchmark and classified as UNDERPRICED (blue). Verify scope is complete.`
      break
    default:
      flagExplanation = `Rate classified as ${flag}.`
  }

  const percentileNote = percentile !== null
    ? ` Within the ${rangeNote}, this rate sits at the ${Math.min(100, Math.max(0, percentile)).toFixed(0)}th percentile${withinRange ? '' : ' (outside observed range)'}.`
    : ''

  return [
    `Item: "${item.description}" matched to category "${category}" (${confLabel} confidence — ${matchResult.reason})`,
    flagExplanation + percentileNote + reliabilityNote,
  ].join(' ')
}

// ─── Public class ─────────────────────────────────────────────────────────────

export class DeviationAnalyzer {
  /**
   * @param {import('../data/BenchmarkStore').BenchmarkStore} store
   */
  constructor(store) {
    if (!store) throw new Error('DeviationAnalyzer requires a BenchmarkStore.')
    this._store = store
    this._matcher = new BenchmarkMatcher(store.getCategories())
  }

  /**
   * Analyse a single BOQ item.
   * @param {BOQItem} item
   * @returns {DeviationResult}
   */
  analyseItem(item) {
    // 1. Match to a benchmark category
    const matchResult = this._matcher.match(item)

    if (!matchResult.category) {
      return {
        item,
        matchResult,
        benchmark:  null,
        deviation:  null,
        percentile: null,
        flag:       null,
        withinRange: null,
        flagColor:  null,
        reasoning:  `Item "${item.description}" could not be matched to any benchmark category. ${matchResult.reason}`,
        reliable:   false,
      }
    }

    // 2. Resolve the best benchmark row
    //    Prefer category+location when the BOQ item has a location
    const benchmark = this._resolveBenchmark(matchResult.category, item.location)

    if (!benchmark || benchmark.avgRate === null) {
      return {
        item,
        matchResult,
        benchmark,
        deviation:  null,
        percentile: null,
        flag:       null,
        withinRange: null,
        flagColor:  null,
        reasoning:  `Matched category "${matchResult.category}" but no benchmark rate data found${item.location ? ` for location "${item.location}"` : ''}.`,
        reliable:   false,
      }
    }

    // 3. Compute deviation metrics
    const deviation  = roundDp(((item.rate - benchmark.avgRate) / benchmark.avgRate) * 100, 1)
    const percentile = calcPercentile(item.rate, benchmark.minRate, benchmark.maxRate)
    const flag       = classifyDeviation(deviation)
    const withinRange = percentile !== null ? (percentile >= 0 && percentile <= 100) : null
    const reliable   = (benchmark.occurrences ?? 0) >= MIN_RELIABLE_OCCURRENCES

    const metrics = { deviation, flag, percentile, withinRange }
    const reasoning = buildReasoning(item, matchResult, benchmark, metrics)

    return {
      item,
      matchResult,
      benchmark,
      deviation,
      percentile,
      flag,
      withinRange,
      flagColor:  FLAG_COLOR[flag],
      tailwind:   FLAG_TAILWIND[flag],
      reliable,
      reasoning,
    }
  }

  /**
   * Analyse all items in a BOQ parse result.
   * @param {BOQItem[]} items
   * @returns {DeviationResult[]}
   */
  analyseAll(items) {
    return items.map(item => this.analyseItem(item))
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  /**
   * Find the most specific benchmark for a given category + optional location.
   * Falls back to the category-wide row with the most occurrences when no
   * location-specific row exists.
   */
  _resolveBenchmark(category, location) {
    // Try specific location first
    if (location) {
      const normLoc = location.toUpperCase().replace(/\s+/g, '_')
      const candidates = this._store.findByCategory(category)
      const match = candidates.find(b =>
        b.normLocation === normLoc || b.normLocation.includes(normLoc)
      )
      if (match) return match
    }

    // Fall back to the row with the most occurrences in this category
    const all = this._store.findByCategory(category)
    if (!all.length) return null
    return all.reduce((best, b) =>
      (b.occurrences ?? 0) > (best.occurrences ?? 0) ? b : best, all[0])
  }
}
