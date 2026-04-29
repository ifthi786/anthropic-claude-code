import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis,
  CartesianGrid, Tooltip, ReferenceLine,
  ResponsiveContainer, Legend,
} from 'recharts'
import { FLAG } from '../../analysis/DeviationAnalyzer'
import { formatAED } from '../../data/transforms'

// ─── Constants ────────────────────────────────────────────────────────────────

const FLAG_HEX = {
  [FLAG.OVERPRICED]:         '#ef4444',
  [FLAG.SLIGHTLY_EXPENSIVE]: '#f59e0b',
  [FLAG.COMPETITIVE]:        '#10b981',
  [FLAG.UNDERPRICED]:        '#3b82f6',
  unmatched:                 '#94a3b8',
}

const FLAG_LABEL = {
  [FLAG.OVERPRICED]:         'Overpriced',
  [FLAG.SLIGHTLY_EXPENSIVE]: 'Slightly Expensive',
  [FLAG.COMPETITIVE]:        'Competitive',
  [FLAG.UNDERPRICED]:        'Underpriced',
  unmatched:                 'Unmatched',
}

const FLAG_ORDER = [FLAG.OVERPRICED, FLAG.SLIGHTLY_EXPENSIVE, FLAG.COMPETITIVE, FLAG.UNDERPRICED, 'unmatched']

// ─── Tooltip ──────────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.[0]) return null
  const d = payload[0].payload
  return (
    <div className="bg-white border border-slate-200 shadow-lg rounded-xl px-3 py-3 text-xs max-w-64">
      <p className="font-semibold text-slate-800 mb-1.5 text-sm leading-tight">
        {d.description}
      </p>
      <div className="space-y-0.5 text-slate-600">
        <p>BOQ rate: <span className="font-medium">{formatAED(d.rate)}</span></p>
        <p>Benchmark avg: <span className="font-medium">{formatAED(d.benchmarkAvg)}</span></p>
        <p>
          Deviation:{' '}
          <span className="font-semibold" style={{ color: FLAG_HEX[d.flag ?? 'unmatched'] }}>
            {d.deviation !== null ? `${d.deviation > 0 ? '+' : ''}${d.deviation.toFixed(1)}%` : '—'}
          </span>
        </p>
        <p>Category: <span className="font-medium font-mono">{d.category}</span></p>
        {d.confidence !== undefined && (
          <p>Confidence: {(d.confidence * 100).toFixed(0)}%</p>
        )}
      </div>
    </div>
  )
}

// ─── Public component ─────────────────────────────────────────────────────────

/**
 * DeviationScatter — scatter plot of BOQ rate vs deviation %.
 * Requires report._results (live session only; shows a notice when unavailable).
 *
 * @param {{ results: DeviationResult[], className?: string }} props
 */
export default function DeviationScatter({ results, className = '' }) {
  if (!results?.length) {
    return (
      <div className={`card flex flex-col items-center justify-center gap-2 h-48 ${className}`}>
        <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0 0 20.25 18V6A2.25 2.25 0 0 0 18 3.75H6A2.25 2.25 0 0 0 3.75 6v12A2.25 2.25 0 0 0 6 20.25Z" />
        </svg>
        <p className="text-sm text-slate-500">Scatter plot available in the current session</p>
        <p className="text-xs text-slate-400">Re-upload the project file to view item-level data</p>
      </div>
    )
  }

  // Group points by flag for separate Scatter layers (enables per-series colours + legend)
  const byFlag = {}
  for (const r of results) {
    if (r.deviation === null || r.item.rate === null) continue
    const flagKey = r.flag ?? 'unmatched'
    if (!byFlag[flagKey]) byFlag[flagKey] = []
    byFlag[flagKey].push({
      rate:         r.item.rate,
      deviation:    r.deviation,
      description:  r.item.description?.slice(0, 60) ?? '—',
      category:     r.matchResult?.category ?? '—',
      benchmarkAvg: r.benchmark?.avgRate ?? null,
      flag:         flagKey,
      confidence:   r.matchResult?.confidence,
      quantity:     r.item.quantity ?? 1,
    })
  }

  const maxRate = Math.max(...results.map(r => r.item.rate ?? 0)) * 1.05
  const yDomain = ['dataMin - 10', 'dataMax + 10']

  return (
    <div className={`card ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-700">Rate vs Deviation Scatter</h3>
        <span className="text-xs text-slate-400">{results.length} items</span>
      </div>

      <ResponsiveContainer width="100%" height={340}>
        <ScatterChart margin={{ top: 8, right: 24, left: 0, bottom: 16 }}>
          <CartesianGrid stroke="#f1f5f9" />
          <XAxis
            type="number"
            dataKey="rate"
            name="BOQ Rate"
            domain={[0, maxRate]}
            tickFormatter={v => `${(v / 1000).toFixed(0)}K`}
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            label={{ value: 'BOQ Rate (AED)', position: 'insideBottom', offset: -8, fontSize: 11, fill: '#64748b' }}
          />
          <YAxis
            type="number"
            dataKey="deviation"
            name="Deviation %"
            domain={yDomain}
            tickFormatter={v => `${v > 0 ? '+' : ''}${v.toFixed(0)}%`}
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            width={48}
          />
          <ZAxis range={[40, 40]} />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: '11px' }}
          />

          {/* Threshold reference lines */}
          <ReferenceLine y={0}   stroke="#94a3b8" strokeWidth={1.5} />
          <ReferenceLine y={30}  stroke="#ef4444" strokeDasharray="4 3" strokeWidth={1}
            label={{ value: '+30%', position: 'right', fontSize: 9, fill: '#ef4444' }} />
          <ReferenceLine y={15}  stroke="#f59e0b" strokeDasharray="4 3" strokeWidth={1}
            label={{ value: '+15%', position: 'right', fontSize: 9, fill: '#f59e0b' }} />
          <ReferenceLine y={-15} stroke="#3b82f6" strokeDasharray="4 3" strokeWidth={1}
            label={{ value: '-15%', position: 'right', fontSize: 9, fill: '#3b82f6' }} />

          {/* One Scatter layer per flag for colour-coded legend */}
          {FLAG_ORDER.filter(f => byFlag[f]?.length).map(f => (
            <Scatter
              key={f}
              name={FLAG_LABEL[f]}
              data={byFlag[f]}
              fill={FLAG_HEX[f]}
              fillOpacity={0.75}
              strokeWidth={0}
            />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}
