import { formatAED } from '../data/transforms'

// ─── Section builders for the three template placeholders ─────────────────────

function buildBenchmarkSummary(ctx) {
  if (!ctx?.hasBenchmark || !ctx.benchmark) {
    return 'No benchmark data loaded. Ask the user to upload the Benchmark Master .xlsx first.'
  }

  const { categories, projects, locations } = ctx.benchmark
  const lines = [
    `Benchmark master is loaded with the following coverage:`,
    `- Reference projects: ${projects.join(', ')}`,
    `- Locations covered: ${locations.join(', ')}`,
    `- Item categories (${categories.length} total): ${categories.slice(0, 25).join(', ')}${categories.length > 25 ? ` … (+${categories.length - 25} more)` : ''}`,
  ]
  return lines.join('\n')
}

function buildAnalysisSummary(ctx) {
  if (!ctx?.hasAnalysis) {
    if (ctx?.hasBenchmark) {
      return 'No project BOQ has been analysed yet. The user needs to upload a project quotation file in the "Project Analysis" tab.'
    }
    return 'No analysis data available. Neither benchmark nor project BOQ has been loaded.'
  }

  const { summary, financials, flags, topCategories, topOffenders, unmatchedCount, narrative, projectName, generatedAt } = ctx

  const lines = [
    `Project: ${projectName}`,
    `Analysed: ${new Date(generatedAt).toLocaleString('en-AE')}`,
    ``,
    `SUMMARY:`,
    `- Total BOQ items: ${summary.totalItems}`,
    `- Benchmark match rate: ${summary.matchRate?.toFixed(1)}%`,
    `- Flagged items: ${summary.flaggedItems} (${summary.flagRate?.toFixed(1)}% of matched)`,
    `- Unmatched items: ${unmatchedCount}`,
    ``,
    `FINANCIAL EXPOSURE:`,
    `- Total BOQ value: ${formatAED(financials.totalBOQValue)}`,
    `- Estimated overpayment: ${formatAED(financials.overpaymentAED)}`,
    `- Estimated underpayment: ${formatAED(financials.underpaymentAED)}`,
    `- Net variance vs benchmark: ${formatAED(financials.netVarianceAED)}`,
    ``,
    `FLAG DISTRIBUTION:`,
    `- Overpriced (>+30%): ${flags.overpriced ?? 0} items`,
    `- Slightly Expensive (+15–30%): ${flags.slightly_expensive ?? 0} items`,
    `- Competitive (±15%): ${flags.competitive ?? 0} items`,
    `- Underpriced (<-15%): ${flags.underpriced ?? 0} items`,
  ]

  if (topCategories?.length) {
    lines.push(``, `TOP CATEGORIES BY OVERPAYMENT:`)
    topCategories.forEach(c => {
      const sign = c.avgDeviation > 0 ? '+' : ''
      lines.push(`- ${c.label}: avg deviation ${sign}${c.avgDeviation?.toFixed(1)}%, overpayment ${formatAED(c.overpayAED)}, ${c.itemCount} items, worst flag: ${c.worstFlag}`)
    })
  }

  if (topOffenders?.length) {
    lines.push(``, `TOP COST EXPOSURE ITEMS:`)
    topOffenders.forEach((r, i) => {
      const sign = r.deviation > 0 ? '+' : ''
      lines.push(`${i + 1}. ${r.description?.slice(0, 90)} — ${formatAED(r.rate)} quoted vs ${formatAED(r.benchmarkAvg)} benchmark (${sign}${r.deviation?.toFixed(1)}%), qty: ${r.quantity}`)
    })
  }

  if (narrative) {
    lines.push(``, `ANALYST NARRATIVE:`, narrative)
  }

  return lines.join('\n')
}

function buildAvailableQueries(ctx) {
  const base = [
    `"What's the average benchmark rate for [category]?"`,
    `"Which items should we negotiate first?"`,
    `"Where is the highest overpayment exposure?"`,
    `"Is [rate] a good price for [item]?"`,
    `"Explain why [item] is flagged as overpriced."`,
  ]

  if (ctx?.hasAnalysis && ctx?.benchmark?.projects?.length > 1) {
    base.push(`"How does this project compare to ${ctx.benchmark.projects.slice(0, 2).join(' or ')}?"`)
  }

  if (ctx?.hasAnalysis) {
    base.push(`"Give me an executive summary I can share with the team."`)
    base.push(`"Which categories are below benchmark and should we be concerned about quality?"`)
  }

  return base.join('\n')
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Build the full system prompt using the specified Aldar template,
 * with the three {{PLACEHOLDER}} blocks populated from live context.
 *
 * @param {import('../analysis/StorageManager').ChatbotContext | null} ctx
 * @returns {string}
 */
export function buildSystemPrompt(ctx) {
  const benchmarkSummary  = buildBenchmarkSummary(ctx)
  const analysisSummary   = buildAnalysisSummary(ctx)
  const availableQueries  = buildAvailableQueries(ctx)

  return `You are a procurement intelligence assistant for Aldar construction projects in the UAE.

EXPERTISE:
- Sanitaryware, fixtures, fittings, and MEP procurement
- Benchmark analysis across multiple projects
- Cost optimization and supplier negotiation
- BOQ analysis and deviation detection

AVAILABLE DATA:
${benchmarkSummary}

${analysisSummary}

AVAILABLE QUERIES (examples of what you can answer):
${availableQueries}

YOUR CAPABILITIES:
1. Answer questions about benchmark rates
   - "What's the average price for a basin mixer in residential units?"
   - "How much did we pay for WCs across projects?"

2. Explain deviations and flags
   - "Why is item X overpriced?"
   - "Is this basin mixer a good deal at AED 666?"

3. Provide recommendations
   - "Which items should we negotiate?"
   - "What's a fair price for category Y?"

4. Compare projects and items
   - "How does this project compare to Sama Yas?"
   - "Which project has the lowest basin mixer prices?"

5. Identify cost opportunities
   - "Where can we save the most?"
   - "Which categories have the highest overpayment?"

RESPONSE FORMAT:
- Concise, professional tone
- Use bullet points for lists
- Always reference specific numbers (rates, projects, percentages)
- Bold key figures: **AED 666** or **45% above benchmark**
- For recommendations, provide 2-3 actionable next steps

PRICING GUIDANCE:
- Competitive: ±15% of benchmark average
- Slightly Expensive: +15% to +30%
- Overpriced: >+30% (recommend negotiation)
- Underpriced: <-15% (flag quality risks)

TONE:
- Helpful and pragmatic
- Risk-aware (mention if prices are unusually low)
- Procurement-focused`
}

/**
 * Returns a short context label for the chat UI header.
 * @param {import('../analysis/StorageManager').ChatbotContext | null} ctx
 * @returns {string}
 */
export function contextLabel(ctx) {
  if (!ctx) return 'No data loaded'
  if (ctx.hasAnalysis) return `${ctx.projectName} · ${ctx.summary?.totalItems} items`
  if (ctx.hasBenchmark) return 'Benchmark loaded — no BOQ yet'
  return 'No data loaded'
}
