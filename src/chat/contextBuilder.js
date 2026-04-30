import { formatAED } from '../data/transforms'

// ─── System prompt builder ────────────────────────────────────────────────────

const BASE_INSTRUCTIONS = `You are an expert procurement analyst AI assistant for Aldar Properties, a leading UAE real estate developer. You help procurement managers and cost engineers understand BOQ (Bill of Quantities) analysis results, benchmark rates, and cost deviations.

Your role:
- Analyse benchmark data and project quotations for UAE construction projects
- Identify cost overruns, underpricing risks, and areas for negotiation
- Explain flag categories: Overpriced (>+30%), Slightly Expensive (+15–30%), Competitive (±15%), Underpriced (<-15%)
- Reference specific item descriptions, AED rates, and deviation percentages in your answers
- Provide actionable procurement recommendations grounded in the data
- Use UAE construction market context (Abu Dhabi, Dubai, Al Ain, etc.)

Formatting rules:
- Use markdown: **bold** for key figures, bullet lists for recommendations, tables when comparing rates
- Always format currency as AED X,XXX or AED X.XXXm
- Keep answers concise but data-driven
- If asked about items not in the loaded data, say so clearly rather than guessing`

/**
 * Build the full system prompt combining base instructions with live context data.
 * The result is used as the system message with prompt caching.
 *
 * @param {import('../analysis/StorageManager').ChatbotContext | null} ctx
 * @returns {string}
 */
export function buildSystemPrompt(ctx) {
  const sections = [BASE_INSTRUCTIONS]

  if (!ctx || (!ctx.hasAnalysis && !ctx.hasBenchmark)) {
    sections.push(`
## Current Session State
No data is currently loaded. Ask the user to upload the Benchmark Master and/or a Project BOQ via the dashboard tabs before querying specific rates or deviations.`)
    return sections.join('\n\n')
  }

  if (ctx.hasBenchmark && ctx.benchmark) {
    const { categories, projects, locations } = ctx.benchmark
    sections.push(`
## Benchmark Data Available
- **Categories**: ${categories.slice(0, 30).join(', ')}${categories.length > 30 ? ` … (+${categories.length - 30} more)` : ''}
- **Reference projects**: ${projects.join(', ')}
- **Locations covered**: ${locations.join(', ')}`)
  }

  if (!ctx.hasAnalysis) {
    sections.push(`\n## Analysis Status\nBenchmark master is loaded but no project BOQ has been analysed yet. Upload a project file in the "Project Analysis" tab.`)
    return sections.join('\n\n')
  }

  // Full analysis context
  const { summary, financials, flags, topCategories, topOffenders, unmatchedCount, narrative } = ctx

  sections.push(`
## Current Project Analysis
**Project**: ${ctx.projectName}
**Analysed at**: ${new Date(ctx.generatedAt).toLocaleString('en-AE')}

### Summary
- Total items: **${summary.totalItems}**
- Matched to benchmark: **${summary.matchRate?.toFixed(1)}%**
- Flagged items: **${summary.flaggedItems}** (${summary.flagRate?.toFixed(1)}% of matched)
- Unmatched items: ${unmatchedCount}

### Financial Exposure
- Total BOQ value: **${formatAED(financials.totalBOQValue)}**
- Estimated overpayment: **${formatAED(financials.overpaymentAED)}**
- Estimated underpayment: ${formatAED(financials.underpaymentAED)}
- Net variance: ${formatAED(financials.netVarianceAED)}

### Flag Distribution
- 🔴 Overpriced (>+30%): **${flags.overpriced ?? 0} items**
- 🟡 Slightly Expensive (+15–30%): **${flags.slightly_expensive ?? 0} items**
- 🟢 Competitive (±15%): **${flags.competitive ?? 0} items**
- 🔵 Underpriced (<-15%): **${flags.underpriced ?? 0} items**`)

  if (topCategories?.length) {
    sections.push(`
### Top Categories by Exposure
${topCategories.map(c =>
  `- **${c.label}**: avg deviation ${c.avgDeviation > 0 ? '+' : ''}${c.avgDeviation?.toFixed(1)}%, overpayment ${formatAED(c.overpayAED)} (${c.itemCount} items, worst flag: ${c.worstFlag})`
).join('\n')}`)
  }

  if (topOffenders?.length) {
    sections.push(`
### Top Cost Exposure Items
${topOffenders.map((r, i) =>
  `${i + 1}. **${r.description?.slice(0, 80)}** — ${formatAED(r.rate)} vs ${formatAED(r.benchmarkAvg)} benchmark (+${r.deviation?.toFixed(1)}%), qty ${r.quantity}`
).join('\n')}`)
  }

  if (narrative) {
    sections.push(`
### Analyst Narrative
${narrative}`)
  }

  return sections.join('\n\n')
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
