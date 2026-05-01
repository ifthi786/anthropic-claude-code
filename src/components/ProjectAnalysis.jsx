import { useState } from 'react'
import { useApp } from '../context/AppContext'
import FileUpload from './FileUpload'
import {
  SummaryCards, FlagBreakdownChart, CategoryBreakdown,
  DeviationScatter, DetailedTable, ProjectComparison,
} from './viz'
import { exportCSV, exportJSON, printSummary } from '../utils/exportReport'
import { formatAED } from '../data/transforms'
import { FLAG_TAILWIND } from '../analysis/DeviationAnalyzer'

// ─── Tab config ───────────────────────────────────────────────────────────────

const RESULT_TABS = [
  { id: 'overview',    label: 'Overview'    },
  { id: 'charts',      label: 'Charts'      },
  { id: 'table',       label: 'Item Table'  },
  { id: 'comparison',  label: 'Project Comparison' },
]

export default function ProjectAnalysis() {
  const {
    benchmarkFile, projectFile,
    benchmarkStore, analysisReport, analysingBOQ, analysisError,
    handleProjectUpload, clearFile,
  } = useApp()

  const [resultTab, setResultTab] = useState('overview')

  const sideBySide = benchmarkStore?._raw?.sideBySide ?? []

  return (
    <div className="grid gap-6">
      {/* Hero */}
      <div className="card bg-gradient-to-r from-gold-500 to-gold-600 text-white border-0">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-white/15 rounded-xl"><AnalysisIcon /></div>
          <div>
            <h2 className="text-xl font-semibold">Project Quotation Analysis</h2>
            <p className="text-amber-50 text-sm mt-1 max-w-xl">
              Upload a project BOQ or quotation .xlsx. Rates are automatically matched
              to benchmark categories and flagged where they deviate beyond acceptable thresholds.
            </p>
          </div>
        </div>
      </div>

      {/* Prerequisite warning */}
      {!benchmarkFile && (
        <Notice variant="warning">
          No benchmark master loaded. Go to <strong>Benchmark Management</strong> first.
        </Notice>
      )}

      {/* Upload row */}
      <div className="grid lg:grid-cols-2 gap-6 items-start">
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
            <Notice variant="loading">Parsing BOQ and running benchmark comparison…</Notice>
          )}
          {analysisError && !analysingBOQ && (
            <Notice variant="error" title="Analysis error">{analysisError}</Notice>
          )}
        </div>

        {analysisReport && (
          <ExportPanel report={analysisReport} />
        )}
      </div>

      {/* ── Results ─────────────────────────────────────────────────────────── */}
      {analysisReport && (
        <>
          {/* KPI row */}
          <SummaryCards report={analysisReport} />

          {/* Result tabs */}
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
            {RESULT_TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setResultTab(tab.id)}
                className={[
                  'px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-150',
                  resultTab === tab.id
                    ? 'bg-white text-navy-500 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700',
                ].join(' ')}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab panes */}
          {resultTab === 'overview'   && <OverviewPane   report={analysisReport} />}
          {resultTab === 'charts'     && <ChartsPane     report={analysisReport} />}
          {resultTab === 'table'      && <TablePane      report={analysisReport} />}
          {resultTab === 'comparison' && <ComparisonPane sideBySide={sideBySide} />}
        </>
      )}

      {/* Format guide when no analysis yet */}
      {!analysisReport && !analysingBOQ && benchmarkFile && (
        <div className="card border-navy-100 bg-navy-50 max-w-lg">
          <h4 className="text-sm font-semibold text-navy-600 mb-3 flex items-center gap-2">
            <InfoIcon />Expected BOQ Columns
          </h4>
          <p className="text-xs text-navy-600 mb-3">Header row auto-detected. Flexible column names accepted.</p>
          <ul className="text-sm text-navy-800 space-y-1.5">
            {[
              ['Item No / Ref', 'Item reference (optional)'],
              ['Description', 'Item description (required)'],
              ['Category', 'Auto-inferred if absent'],
              ['Unit', 'Unit of measure'],
              ['Quantity', 'Number of units (defaults to 1)'],
              ['Rate (AED)', 'Unit rate in AED (required)'],
              ['Location', 'For location-specific benchmarks'],
            ].map(([col, desc]) => (
              <li key={col} className="flex gap-2 text-xs">
                <span className="font-mono bg-navy-200 text-navy-900 px-1.5 py-0.5 rounded shrink-0">{col}</span>
                <span className="text-navy-700">{desc}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ─── Panes ────────────────────────────────────────────────────────────────────

function OverviewPane({ report }) {
  const { flagCounts, byCategory, topOffenders, narrative } = report
  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="flex flex-col gap-4">
        <FlagBreakdownChart flagCounts={flagCounts} />
        {narrative && (
          <div className="card border-gold-200 bg-gold-50">
            <h4 className="text-xs font-semibold text-gold-700 mb-2 uppercase tracking-wide">Analyst Narrative</h4>
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{narrative}</p>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-4">
        <TopOffendersCard offenders={topOffenders} />
        <UnmatchedCard items={report.unmatchedItems} />
      </div>
    </div>
  )
}

function ChartsPane({ report }) {
  return (
    <div className="grid gap-6">
      <CategoryBreakdown byCategory={report.byCategory} />
      <DeviationScatter results={report._results} />
    </div>
  )
}

function TablePane({ report }) {
  return (
    <DetailedTable results={report._results} />
  )
}

function ComparisonPane({ sideBySide }) {
  return (
    <ProjectComparison sideBySide={sideBySide} />
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ExportPanel({ report }) {
  return (
    <div className="card flex flex-col gap-3 self-start">
      <div className="flex items-center gap-2 mb-1">
        <ExportIcon />
        <h3 className="text-sm font-semibold text-slate-700">Export Report</h3>
      </div>
      <p className="text-xs text-slate-500">Download the analysis in your preferred format.</p>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => exportCSV(report)}  className="btn-secondary text-xs py-2">
          ↓ CSV
        </button>
        <button onClick={() => exportJSON(report)} className="btn-secondary text-xs py-2">
          ↓ JSON
        </button>
        <button onClick={() => printSummary(report)} className="btn-gold text-xs py-2">
          🖨 Print / PDF
        </button>
      </div>
      <div className="pt-2 border-t border-slate-100 text-xs text-slate-400">
        Generated: {new Date(report.generatedAt).toLocaleString('en-AE')}
      </div>
    </div>
  )
}

function TopOffendersCard({ offenders }) {
  if (!offenders?.length) return null
  return (
    <div className="card border-red-100">
      <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
        <span className="text-red-500">🚨</span> Top Cost Exposure
      </h4>
      <div className="space-y-2">
        {offenders.slice(0, 5).map((r, i) => {
          const tw = FLAG_TAILWIND[r.flag] ?? {}
          const overpay = r.benchmark?.avgRate != null
            ? (r.item.rate - r.benchmark.avgRate) * r.item.quantity
            : null
          return (
            <div key={i} className="flex items-start justify-between gap-3 text-xs border-b border-slate-100 pb-2 last:border-0">
              <div className="min-w-0">
                <p className="font-medium text-slate-700 line-clamp-1">{r.item.description}</p>
                <p className="text-slate-400 mt-0.5">
                  {formatAED(r.item.rate)} vs {formatAED(r.benchmark?.avgRate)} benchmark
                </p>
              </div>
              <div className="text-right shrink-0">
                <span className={`status-badge ${tw.bg} ${tw.text} border ${tw.border}`}>
                  +{r.deviation?.toFixed(1)}%
                </span>
                {overpay !== null && (
                  <p className="text-red-500 font-medium mt-0.5">{formatAED(overpay)}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function UnmatchedCard({ items }) {
  if (!items?.length) return null
  return (
    <div className="card border-slate-200 bg-slate-50">
      <h4 className="text-xs font-semibold text-slate-600 mb-2">
        Unmatched Items ({items.length})
      </h4>
      <ul className="text-xs text-slate-500 space-y-1 max-h-28 overflow-y-auto">
        {items.map((it, i) => (
          <li key={i} className="line-clamp-1">• {it.description}</li>
        ))}
      </ul>
    </div>
  )
}

// ─── Notice component ─────────────────────────────────────────────────────────

function Notice({ variant, title, children }) {
  const map = {
    warning: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', icon: '⚠' },
    error:   { bg: 'bg-red-50',   border: 'border-red-200',   text: 'text-red-700',   icon: '✕' },
    loading: { bg: 'bg-gold-50',  border: 'border-gold-200',  text: 'text-gold-700',  icon: '⟳' },
  }
  const s = map[variant] ?? map.warning
  return (
    <div className={`flex items-start gap-3 ${s.bg} border ${s.border} rounded-xl px-4 py-3 text-sm ${s.text}`}>
      <span className={variant === 'loading' ? 'animate-spin inline-block' : ''}>{s.icon}</span>
      <div>
        {title && <p className="font-medium">{title}</p>}
        <p className={title ? 'mt-0.5 opacity-90' : ''}>{children}</p>
      </div>
    </div>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function AnalysisIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0 0 20.25 18V6A2.25 2.25 0 0 0 18 3.75H6A2.25 2.25 0 0 0 3.75 6v12A2.25 2.25 0 0 0 6 20.25Z" />
    </svg>
  )
}

function ExportIcon() {
  return (
    <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  )
}

function InfoIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
    </svg>
  )
}
