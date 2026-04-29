import { formatAED } from '../../data/transforms'
import { FLAG } from '../../analysis/DeviationAnalyzer'

// ─── Colour helpers ────────────────────────────────────────────────────────────

function avgDevFromResults(results) {
  if (!results?.length) return null
  const devs = results.map(r => r.deviation).filter(v => v !== null)
  if (!devs.length) return null
  return devs.reduce((s, v) => s + v, 0) / devs.length
}

// ─── Card primitives ──────────────────────────────────────────────────────────

function Card({ label, value, sub, accent, icon, trend }) {
  const accentMap = {
    red:    { bar: 'bg-red-500',     val: 'text-red-600'     },
    amber:  { bar: 'bg-amber-500',   val: 'text-amber-600'   },
    green:  { bar: 'bg-emerald-500', val: 'text-emerald-600' },
    blue:   { bar: 'bg-blue-500',    val: 'text-blue-600'    },
    navy:   { bar: 'bg-navy-500',    val: 'text-navy-500'    },
    gold:   { bar: 'bg-gold-500',    val: 'text-gold-600'    },
    neutral:{ bar: 'bg-slate-400',   val: 'text-slate-700'   },
  }
  const { bar, val } = accentMap[accent] ?? accentMap.neutral

  return (
    <div className="card relative overflow-hidden flex flex-col gap-2 min-w-0">
      {/* Left colour bar */}
      <div className={`absolute inset-y-0 left-0 w-1 ${bar}`} />

      <div className="flex items-start justify-between pl-3">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide leading-none">{label}</span>
        {icon && <span className="text-lg leading-none">{icon}</span>}
      </div>

      <div className={`text-2xl font-bold tabular-nums leading-none pl-3 ${val}`}>
        {value}
      </div>

      {(sub || trend) && (
        <div className="flex items-center gap-2 pl-3">
          {sub  && <span className="text-xs text-slate-400">{sub}</span>}
          {trend && (
            <span className={`text-xs font-medium ${trend.dir === 'up' ? 'text-red-500' : 'text-emerald-500'}`}>
              {trend.dir === 'up' ? '▲' : '▼'} {trend.label}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Public component ─────────────────────────────────────────────────────────

/**
 * SummaryCards — 6-card KPI grid derived from an AnalysisReport.
 * @param {{ report: AnalysisReport, className?: string }} props
 */
export default function SummaryCards({ report, className = '' }) {
  if (!report) return null

  const { summary, financials, flagCounts } = report
  const results      = report._results ?? []
  const avgDev       = avgDevFromResults(results)
  const criticalCount= (flagCounts[FLAG.OVERPRICED] ?? 0) + (flagCounts[FLAG.SLIGHTLY_EXPENSIVE] ?? 0)
  const avgDevLabel  = avgDev !== null
    ? `${avgDev > 0 ? '+' : ''}${avgDev.toFixed(1)}%`
    : '—'

  return (
    <div className={`grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4 ${className}`}>
      <Card
        label="Total Items"
        value={summary.totalItems}
        sub={`${summary.matchedItems} matched`}
        accent="navy"
        icon="📋"
      />
      <Card
        label="Match Rate"
        value={`${summary.matchRate}%`}
        sub={`${summary.unmatchedItems} unmatched`}
        accent={summary.matchRate >= 80 ? 'green' : summary.matchRate >= 50 ? 'amber' : 'red'}
        icon="🎯"
      />
      <Card
        label="Overpayment"
        value={formatAED(financials.overpaymentAED)}
        sub="vs benchmark avg"
        accent={financials.overpaymentAED > 0 ? 'red' : 'green'}
        icon="📈"
      />
      <Card
        label="Underpayment"
        value={formatAED(financials.underpaymentAED)}
        sub="items below benchmark"
        accent="blue"
        icon="📉"
      />
      <Card
        label="Avg Deviation"
        value={avgDevLabel}
        sub={`${summary.flaggedItems} flagged (${summary.flagRate}%)`}
        accent={avgDev === null ? 'neutral' : avgDev > 15 ? 'red' : avgDev < -15 ? 'blue' : 'green'}
        icon="📊"
      />
      <Card
        label="Critical Flags"
        value={criticalCount}
        sub={`${flagCounts[FLAG.OVERPRICED] ?? 0} overpriced, ${flagCounts[FLAG.SLIGHTLY_EXPENSIVE] ?? 0} high`}
        accent={criticalCount > 0 ? 'amber' : 'green'}
        icon={criticalCount > 0 ? '🚨' : '✅'}
      />
    </div>
  )
}
