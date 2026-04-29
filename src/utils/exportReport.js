/**
 * exportReport.js
 * Client-side export utilities: CSV, JSON download, print-formatted summary.
 */

import { exportAnalysisJSON } from '../analysis/StorageManager'
import { formatAED, toLabel } from '../data/transforms'
import { FLAG } from '../analysis/DeviationAnalyzer'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function csvEscape(v) {
  const s = v === null || v === undefined ? '' : String(v)
  // Wrap in quotes if the value contains comma, quote, or newline
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function csvRow(cells) {
  return cells.map(csvEscape).join(',')
}

function triggerDownload(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function safeName(report) {
  const name = report?.projectMeta?.name ?? 'analysis'
  return name.replace(/[^a-z0-9_-]/gi, '_').toLowerCase()
}

function isoDate() {
  return new Date().toISOString().slice(0, 10)
}

// ─── CSV export ───────────────────────────────────────────────────────────────

const CSV_HEADERS = [
  'Item ID',
  'Description',
  'Matched Category',
  'Match Confidence',
  'Match Tier',
  'Location',
  'Unit',
  'Quantity',
  'BOQ Rate (AED)',
  'Total Value (AED)',
  'Benchmark Avg (AED)',
  'Benchmark Min (AED)',
  'Benchmark Max (AED)',
  'Deviation (%)',
  'Percentile',
  'Flag',
  'Within Range',
  'Reliable Benchmark',
  'Reasoning',
]

/**
 * Export all analysed items as a CSV file.
 * Works off report._results (live session) or report.topOffenders+byCategory (cached).
 *
 * @param {AnalysisReport} report
 */
export function exportCSV(report) {
  const results = report._results
  if (!results?.length) {
    // Fallback: export topOffenders + summary only
    exportSummaryCsv(report)
    return
  }

  const rows = [csvRow(CSV_HEADERS)]

  for (const r of results) {
    rows.push(csvRow([
      r.item.itemId,
      r.item.description,
      r.matchResult.category ?? '',
      r.matchResult.confidence !== undefined ? (r.matchResult.confidence * 100).toFixed(0) + '%' : '',
      r.matchResult.tier ?? '',
      r.item.location ?? '',
      r.item.unit ?? '',
      r.item.quantity ?? 1,
      r.item.rate ?? '',
      r.item.totalValue ?? '',
      r.benchmark?.avgRate ?? '',
      r.benchmark?.minRate ?? '',
      r.benchmark?.maxRate ?? '',
      r.deviation !== null ? r.deviation.toFixed(2) : '',
      r.percentile !== null ? r.percentile?.toFixed(1) : '',
      r.flag ?? 'Unmatched',
      r.withinRange === null ? '' : r.withinRange ? 'Yes' : 'No',
      r.reliable ? 'Yes' : 'No',
      r.reasoning ?? '',
    ]))
  }

  triggerDownload(
    rows.join('\n'),
    `aldar_boq_analysis_${safeName(report)}_${isoDate()}.csv`,
    'text/csv;charset=utf-8;',
  )
}

/** Fallback CSV from cached report (no _results). */
function exportSummaryCsv(report) {
  const headers = ['Category', 'Items', 'Avg Deviation (%)', 'Overpayment (AED)', 'Underpayment (AED)', 'Net Variance (AED)', 'Worst Flag']
  const rows = [csvRow(headers)]
  for (const c of report.byCategory ?? []) {
    rows.push(csvRow([
      c.label,
      c.itemCount,
      c.avgDeviation ?? '',
      c.overpayAED,
      c.underpayAED,
      c.netVariance,
      c.worstFlag ?? '',
    ]))
  }
  triggerDownload(
    rows.join('\n'),
    `aldar_category_summary_${safeName(report)}_${isoDate()}.csv`,
    'text/csv;charset=utf-8;',
  )
}

// ─── JSON export ──────────────────────────────────────────────────────────────

/**
 * Download the full analysis report as a JSON file.
 * @param {AnalysisReport} report
 */
export function exportJSON(report) {
  const url      = exportAnalysisJSON(report)
  const filename = `aldar_analysis_${safeName(report)}_${isoDate()}.json`
  const a        = document.createElement('a')
  a.href         = url
  a.download     = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ─── Print-formatted summary ──────────────────────────────────────────────────

/**
 * Open a new tab with a print-ready HTML summary and trigger the print dialog.
 * @param {AnalysisReport} report
 */
export function printSummary(report) {
  const { summary, financials, flagCounts, byCategory, topOffenders, narrative, projectMeta } = report
  const projectName = projectMeta?.name ?? 'Project Analysis'
  const date        = new Date(report.generatedAt).toLocaleDateString('en-AE', { dateStyle: 'long' })

  const flagRow = (flag, count, color) => count
    ? `<tr><td style="padding:4px 8px;border:1px solid #e2e8f0">${flag.replace(/_/g,' ')}</td>
       <td style="padding:4px 8px;border:1px solid #e2e8f0;font-weight:600;color:${color}">${count}</td></tr>`
    : ''

  const catRows = (byCategory ?? []).slice(0, 15).map(c => `
    <tr>
      <td style="padding:4px 8px;border:1px solid #e2e8f0">${c.label}</td>
      <td style="padding:4px 8px;border:1px solid #e2e8f0;text-align:right">${c.itemCount}</td>
      <td style="padding:4px 8px;border:1px solid #e2e8f0;text-align:right;color:${c.avgDeviation > 0 ? '#dc2626' : '#059669'}">${c.avgDeviation != null ? (c.avgDeviation > 0 ? '+' : '') + c.avgDeviation.toFixed(1) + '%' : '—'}</td>
      <td style="padding:4px 8px;border:1px solid #e2e8f0;text-align:right">${formatAED(c.overpayAED)}</td>
    </tr>
  `).join('')

  const offenderRows = (topOffenders ?? []).slice(0, 8).map((r, i) => `
    <tr>
      <td style="padding:4px 8px;border:1px solid #e2e8f0">${i + 1}</td>
      <td style="padding:4px 8px;border:1px solid #e2e8f0">${r.item?.description?.slice(0, 60) ?? '—'}</td>
      <td style="padding:4px 8px;border:1px solid #e2e8f0;text-align:right">${formatAED(r.item?.rate)}</td>
      <td style="padding:4px 8px;border:1px solid #e2e8f0;text-align:right">${formatAED(r.benchmark?.avgRate)}</td>
      <td style="padding:4px 8px;border:1px solid #e2e8f0;text-align:right;color:#dc2626">${r.deviation != null ? '+' + r.deviation.toFixed(1) + '%' : '—'}</td>
    </tr>
  `).join('')

  const html = `<!DOCTYPE html>
<html><head>
  <meta charset="UTF-8">
  <title>Aldar Procurement Analysis — ${projectName}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 11pt; color: #1e293b; margin: 20mm; }
    h1   { color: #003366; font-size: 16pt; border-bottom: 3px solid #D4AF37; padding-bottom: 6px; }
    h2   { color: #003366; font-size: 12pt; margin-top: 16px; }
    .meta { color: #64748b; font-size: 9pt; margin-bottom: 16px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 12px 0; }
    .kpi { border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px; }
    .kpi-val { font-size: 16pt; font-weight: 700; color: #003366; }
    .kpi-lbl { font-size: 8pt; color: #64748b; }
    table { border-collapse: collapse; width: 100%; font-size: 9pt; margin-bottom: 12px; }
    th    { background: #f1f5f9; padding: 5px 8px; border: 1px solid #e2e8f0; text-align: left; }
    .narrative { background: #f8fafc; border-left: 4px solid #D4AF37; padding: 10px 14px; font-size: 9.5pt; line-height: 1.6; white-space: pre-line; }
    @media print { body { margin: 15mm; } }
  </style>
</head><body>
  <h1>Aldar Procurement Benchmark Report</h1>
  <p class="meta">Project: <strong>${projectName}</strong> · Generated: ${date} · Aldar Properties PJSC — Internal Use Only</p>

  <h2>Executive Summary</h2>
  <div class="kpi-grid">
    <div class="kpi"><div class="kpi-val">${summary.totalItems}</div><div class="kpi-lbl">Total Items</div></div>
    <div class="kpi"><div class="kpi-val">${summary.matchRate}%</div><div class="kpi-lbl">Match Rate</div></div>
    <div class="kpi"><div class="kpi-val">${summary.flaggedItems}</div><div class="kpi-lbl">Flagged Items</div></div>
    <div class="kpi"><div class="kpi-val">${formatAED(financials.totalBOQValue)}</div><div class="kpi-lbl">Total BOQ Value</div></div>
    <div class="kpi"><div class="kpi-val" style="color:#dc2626">${formatAED(financials.overpaymentAED)}</div><div class="kpi-lbl">Overpayment Exposure</div></div>
    <div class="kpi"><div class="kpi-val" style="color:${financials.netVarianceAED > 0 ? '#dc2626' : '#059669'}">${formatAED(financials.netVarianceAED)}</div><div class="kpi-lbl">Net Variance</div></div>
  </div>

  <h2>Analyst Narrative</h2>
  <div class="narrative">${narrative ?? ''}</div>

  <h2>Flag Distribution</h2>
  <table>
    <tr><th>Flag</th><th>Count</th></tr>
    ${flagRow('Overpriced',        flagCounts[FLAG.OVERPRICED],         '#dc2626')}
    ${flagRow('Slightly Expensive',flagCounts[FLAG.SLIGHTLY_EXPENSIVE], '#d97706')}
    ${flagRow('Competitive',       flagCounts[FLAG.COMPETITIVE],        '#059669')}
    ${flagRow('Underpriced',       flagCounts[FLAG.UNDERPRICED],        '#2563eb')}
  </table>

  <h2>Category Breakdown (top 15 by overpayment)</h2>
  <table>
    <tr><th>Category</th><th style="text-align:right">Items</th><th style="text-align:right">Avg Deviation</th><th style="text-align:right">Overpayment</th></tr>
    ${catRows}
  </table>

  <h2>Top Cost Exposure Items</h2>
  <table>
    <tr><th>#</th><th>Description</th><th style="text-align:right">BOQ Rate</th><th style="text-align:right">Benchmark</th><th style="text-align:right">Deviation</th></tr>
    ${offenderRows}
  </table>
</body></html>`

  const win = window.open('', '_blank')
  win.document.write(html)
  win.document.close()
  win.onload = () => win.print()
}
