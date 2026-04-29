import { useApp } from '../context/AppContext'
import FileUpload from './FileUpload'
import { FLAG, FLAG_TAILWIND } from '../analysis/DeviationAnalyzer'
import { formatAED, toLabel } from '../data/transforms'

export default function ProjectAnalysis() {
  const {
    benchmarkFile, projectFile,
    analysisReport, analysingBOQ, analysisError,
    handleProjectUpload, clearFile,
  } = useApp()

  return (
    <div className="grid gap-6">
      {/* Hero */}
      <div className="card bg-gradient-to-r from-gold-500 to-gold-600 text-white border-0">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-white/15 rounded-xl"><AnalysisIcon /></div>
          <div>
            <h2 className="text-xl font-semibold">Project Quotation Analysis</h2>
            <p className="text-amber-50 text-sm mt-1 max-w-xl">
              Upload a project BOQ or quotation .xlsx. Rates are automatically matched to
              benchmark categories and flagged where they deviate beyond acceptable thresholds.
            </p>
          </div>
        </div>
      </div>

      {/* Prerequisite warning */}
      {!benchmarkFile && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 max-w-2xl">
          <WarningIcon />
          <p>No benchmark master is loaded. Go to <strong>Benchmark Management</strong> first.</p>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6 items-start">
        {/* Left: upload */}
        <div className="flex flex-col gap-4">
          <FileUpload
            id="project-upload"
            title="Upload Project Quotation"
            description="Upload the contractor quotation or BOQ .xlsx for this project."
            accentColor="navy"
            currentFile={projectFile}
            onUpload={handleProjectUpload}
            onClear={() => clearFile('project')}
          />

          {analysingBOQ && (
            <div className="flex items-center gap-3 bg-gold-50 border border-gold-200 rounded-xl px-4 py-3 text-sm text-gold-700">
              <SpinnerIcon />
              Parsing BOQ and running benchmark comparison…
            </div>
          )}

          {analysisError && !analysingBOQ && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
              <AlertIcon />
              <div>
                <p className="font-medium">Analysis error</p>
                <p className="mt-0.5 text-red-600">{analysisError}</p>
              </div>
            </div>
          )}

          {analysisReport && <SummaryCard report={analysisReport} />}
        </div>

        {/* Right: results */}
        <div className="flex flex-col gap-4">
          {analysisReport
            ? <DetailPanel report={analysisReport} />
            : <FormatGuide />
          }
        </div>
      </div>

      {/* Full item table */}
      {analysisReport && <ItemTable report={analysisReport} />}
    </div>
  )
}

// ─── Summary card ──────────────────────────────────────────────────────────────

function SummaryCard({ report }) {
  const { summary, financials, flagCounts } = report

  return (
    <div className="card border-emerald-200 bg-emerald-50">
      <h3 className="text-sm font-semibold text-emerald-800 mb-3 flex items-center gap-2">
        <CheckIcon />
        Analysis complete
      </h3>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <Stat label="Items analysed"    value={summary.totalItems} />
        <Stat label="Match rate"        value={`${summary.matchRate}%`} />
        <Stat label="Flagged items"     value={summary.flaggedItems} />
        <Stat label="Total BOQ value"   value={formatAED(financials.totalBOQValue)} />
        <Stat label="Overpayment est."  value={formatAED(financials.overpaymentAED)} accent="red" />
        <Stat label="Net variance"      value={formatAED(financials.netVarianceAED)} accent={financials.netVarianceAED > 0 ? 'red' : 'green'} />
      </div>

      {/* Flag pills */}
      <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-emerald-200">
        {Object.entries(flagCounts).map(([flag, count]) => {
          if (!count) return null
          const tw = FLAG_TAILWIND[flag] ?? {}
          return (
            <span key={flag} className={`status-badge ${tw.bg} ${tw.text} border ${tw.border}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${tw.dot}`} />
              {count} {flag.replace(/_/g, ' ')}
            </span>
          )
        })}
      </div>
    </div>
  )
}

// ─── Detail panel (categories + top offenders) ────────────────────────────────

function DetailPanel({ report }) {
  const { byCategory, topOffenders } = report

  return (
    <div className="flex flex-col gap-4">
      {/* By category */}
      <div className="card">
        <h4 className="text-sm font-semibold text-slate-700 mb-3">By Category</h4>
        <div className="space-y-2">
          {byCategory.slice(0, 8).map(c => {
            const tw = FLAG_TAILWIND[c.worstFlag] ?? {}
            return (
              <div key={c.category} className="flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${tw.dot ?? 'bg-slate-300'}`} />
                  <span className="truncate text-slate-700">{c.label}</span>
                  <span className="text-slate-400 text-xs shrink-0">{c.itemCount} items</span>
                </div>
                <div className="text-right shrink-0">
                  <span className={`font-medium ${c.avgDeviation > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {c.avgDeviation !== null ? `${c.avgDeviation > 0 ? '+' : ''}${c.avgDeviation?.toFixed(1)}%` : '—'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Top offenders */}
      {topOffenders.length > 0 && (
        <div className="card border-red-100 bg-red-50">
          <h4 className="text-sm font-semibold text-red-700 mb-3 flex items-center gap-2">
            <AlertIcon className="text-red-500" />
            Top Cost Exposure
          </h4>
          <div className="space-y-3">
            {topOffenders.slice(0, 5).map((r, i) => {
              const tw = FLAG_TAILWIND[r.flag] ?? {}
              return (
                <div key={i} className="text-xs border-b border-red-100 last:border-0 pb-2 last:pb-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-slate-700 font-medium leading-tight">
                      {r.item.description.slice(0, 60)}{r.item.description.length > 60 ? '…' : ''}
                    </p>
                    <span className={`status-badge shrink-0 ${tw.bg} ${tw.text} border ${tw.border}`}>
                      {r.flag?.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="flex gap-4 mt-1 text-slate-500">
                    <span>Quoted: {formatAED(r.item.rate)}</span>
                    <span>Benchmark: {formatAED(r.benchmark?.avgRate)}</span>
                    <span className="text-red-600 font-medium">+{r.deviation?.toFixed(1)}%</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Full item table ───────────────────────────────────────────────────────────

function ItemTable({ report }) {
  const results = report._results ?? []
  if (!results.length) return null

  return (
    <div className="card overflow-hidden p-0">
      <div className="px-6 py-4 border-b border-slate-200">
        <h3 className="text-sm font-semibold text-slate-700">All Items</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left">
              <th className="px-4 py-2.5 font-medium text-slate-500 w-8">#</th>
              <th className="px-4 py-2.5 font-medium text-slate-500">Description</th>
              <th className="px-4 py-2.5 font-medium text-slate-500">Category</th>
              <th className="px-4 py-2.5 font-medium text-slate-500 text-right">Rate (AED)</th>
              <th className="px-4 py-2.5 font-medium text-slate-500 text-right">Benchmark Avg</th>
              <th className="px-4 py-2.5 font-medium text-slate-500 text-right">Deviation</th>
              <th className="px-4 py-2.5 font-medium text-slate-500">Status</th>
              <th className="px-4 py-2.5 font-medium text-slate-500">Confidence</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {results.map((r, i) => {
              const tw = FLAG_TAILWIND[r.flag] ?? {}
              const devStr = r.deviation !== null
                ? `${r.deviation > 0 ? '+' : ''}${r.deviation.toFixed(1)}%`
                : '—'
              return (
                <tr key={i} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-2.5 text-slate-400">{i + 1}</td>
                  <td className="px-4 py-2.5 text-slate-700 max-w-xs">
                    <span className="line-clamp-1">{r.item.description}</span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 font-mono text-xs">
                    {r.matchResult.category
                      ? <span className="bg-navy-50 text-navy-600 px-1.5 py-0.5 rounded">{r.matchResult.category}</span>
                      : <span className="text-slate-400">—</span>
                    }
                  </td>
                  <td className="px-4 py-2.5 text-slate-700 text-right tabular-nums">
                    {formatAED(r.item.rate, { showUnit: false })}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 text-right tabular-nums">
                    {r.benchmark?.avgRate !== null && r.benchmark?.avgRate !== undefined
                      ? formatAED(r.benchmark.avgRate, { showUnit: false })
                      : '—'}
                  </td>
                  <td className={`px-4 py-2.5 text-right tabular-nums font-medium ${
                    r.deviation === null ? 'text-slate-400' :
                    r.deviation > 15  ? 'text-red-600'     :
                    r.deviation < -15 ? 'text-blue-600'    : 'text-emerald-600'
                  }`}>
                    {devStr}
                  </td>
                  <td className="px-4 py-2.5">
                    {r.flag
                      ? <span className={`status-badge ${tw.bg} ${tw.text} border ${tw.border}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${tw.dot}`} />
                          {r.flag.replace(/_/g, ' ')}
                        </span>
                      : <span className="text-slate-400 text-xs">Unmatched</span>
                    }
                  </td>
                  <td className="px-4 py-2.5">
                    <ConfidenceBadge confidence={r.matchResult.confidence} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ConfidenceBadge({ confidence }) {
  if (!confidence) return <span className="text-xs text-slate-400">—</span>
  const label = confidence >= 0.95 ? 'Exact'
              : confidence >= 0.80 ? 'High'
              : confidence >= 0.55 ? 'Medium'
              : 'Low'
  const cls = confidence >= 0.80 ? 'text-emerald-600'
            : confidence >= 0.55 ? 'text-amber-600'
            : 'text-red-500'
  return <span className={`text-xs font-medium ${cls}`}>{label}</span>
}

function Stat({ label, value, accent }) {
  const valCls = accent === 'red'   ? 'text-red-600'     :
                 accent === 'green' ? 'text-emerald-600'  : 'text-slate-800'
  return (
    <>
      <span className="text-slate-500">{label}</span>
      <span className={`font-semibold text-right ${valCls}`}>{value}</span>
    </>
  )
}

function FormatGuide() {
  return (
    <div className="card border-navy-100 bg-navy-50">
      <h4 className="text-sm font-semibold text-navy-600 mb-3 flex items-center gap-2">
        <InfoIcon />
        Expected BOQ Columns
      </h4>
      <p className="text-xs text-navy-600 mb-3">
        The parser auto-detects header rows and flexible column names.
      </p>
      <ul className="text-sm text-navy-800 space-y-1.5">
        {[
          ['Item No / Ref', 'Item reference or serial number'],
          ['Description',   'Item description (required)'],
          ['Category',      'Optional — matched automatically if absent'],
          ['Unit',          'Unit of measure (Nr, m², etc.)'],
          ['Quantity',      'Number of units'],
          ['Rate (AED)',     'Unit rate in AED (required)'],
          ['Location',      'Area/location for location-specific benchmarking'],
        ].map(([col, desc]) => (
          <li key={col} className="flex gap-2">
            <span className="font-mono text-xs bg-navy-200 text-navy-900 px-1.5 py-0.5 rounded shrink-0">{col}</span>
            <span className="text-navy-700">{desc}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── Icons ─────────────────────────────────────────────────────────────────────

function AnalysisIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0 0 20.25
           18V6A2.25 2.25 0 0 0 18 3.75H6A2.25 2.25 0 0 0 3.75 6v12A2.25 2.25 0 0 0 6 20.25Z"
      />
    </svg>
  )
}

function WarningIcon() {
  return (
    <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874
           1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
      />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4 shrink-0 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
  )
}

function AlertIcon({ className = 'text-red-500' }) {
  return (
    <svg className={`w-4 h-4 shrink-0 ${className}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874
           1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
      />
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg className="w-4 h-4 shrink-0 animate-spin text-gold-600" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z" />
    </svg>
  )
}

function InfoIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21
           12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z"
      />
    </svg>
  )
}
