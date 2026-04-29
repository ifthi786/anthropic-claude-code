/**
 * ReportGenerator
 * Aggregates DeviationResult[] into a structured report with financial metrics
 * and pre-written narrative text for the chatbot.
 */

import { FLAG, FLAG_COLOR } from './DeviationAnalyzer'
import { formatAED, toLabel } from '../data/transforms'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sum(arr) {
  return arr.reduce((s, v) => s + (v ?? 0), 0)
}

function avg(arr) {
  const valid = arr.filter(v => v !== null && v !== undefined && !isNaN(v))
  return valid.length ? sum(valid) / valid.length : null
}

function pct(part, total) {
  if (!total) return 0
  return Math.round((part / total) * 100)
}

function roundAED(v) {
  return Math.round(v * 100) / 100
}

// Severity order for sorting (worst first)
const FLAG_SEVERITY = {
  [FLAG.OVERPRICED]:         4,
  [FLAG.SLIGHTLY_EXPENSIVE]: 3,
  [FLAG.COMPETITIVE]:        2,
  [FLAG.UNDERPRICED]:        1,
}

// ─── Public class ─────────────────────────────────────────────────────────────

export class ReportGenerator {
  /**
   * Generate a full analysis report from deviation results.
   *
   * @param {DeviationResult[]}    results      Output of DeviationAnalyzer.analyseAll()
   * @param {BOQParseResult}       boqMeta      Output of BOQParser.parse() (metadata only, no items)
   * @param {{ name?: string, uploadedAt?: string, fileMetadata?: object }} [projectMeta]
   * @returns {AnalysisReport}
   */
  static generate(results, boqMeta = {}, projectMeta = {}) {
    const matched   = results.filter(r => r.matchResult.category !== null)
    const unmatched = results.filter(r => r.matchResult.category === null)
    const flagged   = matched.filter(r => r.flag && r.flag !== FLAG.COMPETITIVE)
    const analysed  = matched.filter(r => r.flag !== null)

    // ── Summary ────────────────────────────────────────────────────────────────
    const summary = {
      totalItems:      results.length,
      matchedItems:    matched.length,
      unmatchedItems:  unmatched.length,
      matchRate:       pct(matched.length, results.length),
      flaggedItems:    flagged.length,
      flagRate:        pct(flagged.length, analysed.length),
    }

    // ── Financial totals ───────────────────────────────────────────────────────
    const totalBOQValue = roundAED(sum(results.map(r => r.item.totalValue ?? 0)))

    const overpricedItems  = analysed.filter(r => r.flag === FLAG.OVERPRICED)
    const slightlyExpItems = analysed.filter(r => r.flag === FLAG.SLIGHTLY_EXPENSIVE)
    const underpricedItems = analysed.filter(r => r.flag === FLAG.UNDERPRICED)

    // Overpayment per item = (rate - avgRate) * quantity  [only positive]
    const calcOverpay = items =>
      roundAED(sum(items.map(r =>
        r.benchmark?.avgRate !== null
          ? Math.max(0, (r.item.rate - r.benchmark.avgRate) * r.item.quantity)
          : 0
      )))

    const calcUnderpay = items =>
      roundAED(sum(items.map(r =>
        r.benchmark?.avgRate !== null
          ? Math.max(0, (r.benchmark.avgRate - r.item.rate) * r.item.quantity)
          : 0
      )))

    const financials = {
      totalBOQValue,
      overpaymentAED:   calcOverpay([...overpricedItems, ...slightlyExpItems]),
      underpaymentAED:  calcUnderpay(underpricedItems),
      // Net = difference if all analysed items were at benchmark avgRate
      netVarianceAED:   roundAED(
        sum(analysed.map(r =>
          r.benchmark?.avgRate !== null
            ? (r.item.rate - r.benchmark.avgRate) * r.item.quantity
            : 0
        ))
      ),
    }

    // ── Flag distribution ──────────────────────────────────────────────────────
    const flagCounts = {
      [FLAG.OVERPRICED]:         overpricedItems.length,
      [FLAG.SLIGHTLY_EXPENSIVE]: slightlyExpItems.length,
      [FLAG.COMPETITIVE]:        analysed.filter(r => r.flag === FLAG.COMPETITIVE).length,
      [FLAG.UNDERPRICED]:        underpricedItems.length,
    }

    // ── By category ───────────────────────────────────────────────────────────
    const catMap = new Map()
    for (const r of analysed) {
      const cat = r.matchResult.category
      if (!catMap.has(cat)) {
        catMap.set(cat, { items: [], overpay: 0, underpay: 0 })
      }
      const entry = catMap.get(cat)
      entry.items.push(r)
      if (r.benchmark?.avgRate !== null) {
        const diff = (r.item.rate - r.benchmark.avgRate) * r.item.quantity
        if (diff > 0) entry.overpay  += diff
        else          entry.underpay += Math.abs(diff)
      }
    }

    const byCategory = [...catMap.entries()]
      .map(([category, { items, overpay, underpay }]) => {
        const deviations = items.map(r => r.deviation).filter(v => v !== null)
        const flagDist   = {}
        for (const r of items) {
          if (r.flag) flagDist[r.flag] = (flagDist[r.flag] ?? 0) + 1
        }
        const worstFlag = Object.keys(flagDist).sort(
          (a, b) => (FLAG_SEVERITY[b] ?? 0) - (FLAG_SEVERITY[a] ?? 0)
        )[0] ?? null

        return {
          category,
          label:         toLabel(category),
          itemCount:     items.length,
          avgDeviation:  avg(deviations) !== null ? roundAED(avg(deviations)) : null,
          overpayAED:    roundAED(overpay),
          underpayAED:   roundAED(underpay),
          netVariance:   roundAED(overpay - underpay),
          flagDistribution: flagDist,
          worstFlag,
          worstFlagColor: worstFlag ? FLAG_COLOR[worstFlag] : null,
          items,          // kept for chatbot context; stripped in export
        }
      })
      .sort((a, b) => b.overpayAED - a.overpayAED)

    // ── By location ───────────────────────────────────────────────────────────
    const locMap = new Map()
    for (const r of analysed) {
      const loc = r.benchmark?.normLocation ?? r.item.location ?? 'UNKNOWN'
      if (!locMap.has(loc)) locMap.set(loc, { items: [], overpay: 0 })
      const entry = locMap.get(loc)
      entry.items.push(r)
      if (r.benchmark?.avgRate !== null) {
        const diff = (r.item.rate - r.benchmark.avgRate) * r.item.quantity
        if (diff > 0) entry.overpay += diff
      }
    }

    const byLocation = [...locMap.entries()]
      .map(([location, { items, overpay }]) => ({
        location,
        label:       toLabel(location),
        itemCount:   items.length,
        priceIndex:  items[0]?.benchmark?.priceIndex ?? null,
        overpayAED:  roundAED(overpay),
      }))
      .sort((a, b) => b.overpayAED - a.overpayAED)

    // ── Top offenders ─────────────────────────────────────────────────────────
    const topOffenders = analysed
      .filter(r => r.flag === FLAG.OVERPRICED || r.flag === FLAG.SLIGHTLY_EXPENSIVE)
      .sort((a, b) => {
        // Sort by absolute overpayment
        const aOverpay = (a.item.rate - (a.benchmark?.avgRate ?? a.item.rate)) * a.item.quantity
        const bOverpay = (b.item.rate - (b.benchmark?.avgRate ?? b.item.rate)) * b.item.quantity
        return bOverpay - aOverpay
      })
      .slice(0, 10)

    // ── Unmatched items ────────────────────────────────────────────────────────
    const unmatchedList = unmatched.map(r => ({
      itemId:      r.item.itemId,
      description: r.item.description,
      rate:        r.item.rate,
      reason:      r.reasoning,
    }))

    // ── Narrative for chatbot ──────────────────────────────────────────────────
    const narrative = buildNarrative({
      projectMeta, summary, financials, flagCounts,
      byCategory, topOffenders, unmatchedList,
    })

    return {
      generatedAt:  new Date().toISOString(),
      projectMeta,
      boqMeta: {
        sheetName:       boqMeta.sheetName,
        headerRowIndex:  boqMeta.headerRowIndex,
        warnings:        boqMeta.warnings ?? [],
      },
      summary,
      financials,
      flagCounts,
      byCategory:    byCategory.map(c => ({ ...c, items: undefined })), // strip items
      byLocation,
      topOffenders,
      unmatchedItems: unmatchedList,
      narrative,
      // Full results kept for storage / chatbot context
      _results: results,
    }
  }
}

// ─── Narrative builder ────────────────────────────────────────────────────────

function buildNarrative({ projectMeta, summary, financials, flagCounts, byCategory, topOffenders, unmatchedList }) {
  const name = projectMeta?.name ?? 'the submitted project'
  const lines = []

  // Opening summary
  lines.push(
    `Analysis of ${name} identified ${summary.totalItems} BOQ items. ` +
    `${summary.matchedItems} items (${summary.matchRate}%) were successfully matched to benchmark categories, ` +
    `and ${summary.flaggedItems} of those (${summary.flagRate}%) require attention.`
  )

  // Financial headline
  if (financials.netVarianceAED !== 0) {
    const dir = financials.netVarianceAED > 0 ? 'above' : 'below'
    lines.push(
      `Overall, the quotation is ${formatAED(Math.abs(financials.netVarianceAED))} ${dir} the weighted benchmark average. ` +
      `Potential overpayment exposure: ${formatAED(financials.overpaymentAED)}.`
    )
  }

  // Flag distribution
  const flagSummary = [
    flagCounts[FLAG.OVERPRICED]         ? `${flagCounts[FLAG.OVERPRICED]} Overpriced`           : null,
    flagCounts[FLAG.SLIGHTLY_EXPENSIVE] ? `${flagCounts[FLAG.SLIGHTLY_EXPENSIVE]} Slightly Expensive` : null,
    flagCounts[FLAG.COMPETITIVE]        ? `${flagCounts[FLAG.COMPETITIVE]} Competitive`          : null,
    flagCounts[FLAG.UNDERPRICED]        ? `${flagCounts[FLAG.UNDERPRICED]} Underpriced`          : null,
  ].filter(Boolean)
  if (flagSummary.length) {
    lines.push(`Flag breakdown: ${flagSummary.join(', ')}.`)
  }

  // Top categories with issues
  const problemCats = byCategory.filter(c =>
    c.worstFlag === FLAG.OVERPRICED || c.worstFlag === FLAG.SLIGHTLY_EXPENSIVE
  ).slice(0, 3)
  if (problemCats.length) {
    const catDescs = problemCats.map(c =>
      `${c.label} (+${c.avgDeviation?.toFixed(1) ?? '?'}% avg deviation, ${formatAED(c.overpayAED)} overpayment)`
    ).join('; ')
    lines.push(`Categories with highest cost exposure: ${catDescs}.`)
  }

  // Top offenders
  if (topOffenders.length) {
    const top = topOffenders[0]
    const overpay = top.benchmark?.avgRate !== null
      ? formatAED((top.item.rate - top.benchmark.avgRate) * top.item.quantity)
      : 'N/A'
    lines.push(
      `The single highest overpayment item is "${top.item.description}" ` +
      `(${formatAED(top.item.rate)}/unit vs benchmark ${formatAED(top.benchmark?.avgRate)}) ` +
      `with ${overpay} in excess cost for ${top.item.quantity} unit(s).`
    )
  }

  // Unmatched
  if (unmatchedList.length) {
    lines.push(
      `${unmatchedList.length} item(s) could not be matched to any benchmark category and require manual review.`
    )
  }

  return lines.join('\n\n')
}
