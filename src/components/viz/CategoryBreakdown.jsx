import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { formatAED, toLabel } from '../../data/transforms'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const OVERPAY_COLOR   = '#ef4444'
const UNDERPAY_COLOR  = '#3b82f6'
const DEV_POS_COLOR   = '#f59e0b'
const DEV_NEG_COLOR   = '#10b981'

function abbrev(label, max = 14) {
  return label.length > max ? label.slice(0, max - 1) + '…' : label
}

function fmtAED(v) {
  if (!v) return '—'
  if (Math.abs(v) >= 1_000_000) return `AED ${(v / 1_000_000).toFixed(1)}M`
  if (Math.abs(v) >= 1_000)     return `AED ${(v / 1_000).toFixed(0)}K`
  return `AED ${v.toFixed(0)}`
}

// ─── Tooltips ─────────────────────────────────────────────────────────────────

function FinancialTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 shadow-lg rounded-lg px-3 py-2 text-sm min-w-40">
      <p className="font-semibold text-slate-800 mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.color }} className="text-xs">
          {p.name}: {formatAED(p.value)}
        </p>
      ))}
    </div>
  )
}

function DeviationTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const val = payload[0]?.value
  return (
    <div className="bg-white border border-slate-200 shadow-lg rounded-lg px-3 py-2 text-sm">
      <p className="font-semibold text-slate-800">{label}</p>
      <p style={{ color: val > 0 ? OVERPAY_COLOR : DEV_NEG_COLOR }} className="text-xs font-medium">
        Avg deviation: {val > 0 ? '+' : ''}{val?.toFixed(1)}%
      </p>
    </div>
  )
}

// ─── Sub-charts ───────────────────────────────────────────────────────────────

function FinancialBars({ data }) {
  return (
    <div>
      <p className="text-xs text-slate-500 mb-2 font-medium">Financial Exposure by Category (AED)</p>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart
          data={data}
          margin={{ top: 4, right: 8, left: 0, bottom: 40 }}
          barCategoryGap="25%"
          barGap={2}
        >
          <CartesianGrid vertical={false} stroke="#f1f5f9" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: '#64748b' }}
            interval={0}
            angle={-35}
            textAnchor="end"
            height={50}
          />
          <YAxis
            tickFormatter={fmtAED}
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            width={56}
          />
          <Tooltip content={<FinancialTooltip />} cursor={{ fill: '#f8fafc' }} />
          <Legend
            iconType="square"
            iconSize={10}
            wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
          />
          <Bar dataKey="overpayAED"  name="Overpayment"  fill={OVERPAY_COLOR}  radius={[2, 2, 0, 0]} maxBarSize={28} />
          <Bar dataKey="underpayAED" name="Underpayment" fill={UNDERPAY_COLOR} radius={[2, 2, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function DeviationBars({ data }) {
  return (
    <div>
      <p className="text-xs text-slate-500 mb-2 font-medium">Average Deviation % by Category</p>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart
          data={data}
          margin={{ top: 4, right: 8, left: 0, bottom: 40 }}
        >
          <CartesianGrid vertical={false} stroke="#f1f5f9" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: '#64748b' }}
            interval={0}
            angle={-35}
            textAnchor="end"
            height={50}
          />
          <YAxis
            tickFormatter={v => `${v > 0 ? '+' : ''}${v}%`}
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            width={48}
          />
          <Tooltip content={<DeviationTooltip />} cursor={{ fill: '#f8fafc' }} />
          <ReferenceLine y={0}   stroke="#94a3b8" strokeWidth={1} />
          <ReferenceLine y={15}  stroke={OVERPAY_COLOR}  strokeDasharray="3 3" strokeWidth={1} label={{ value: '+15%', position: 'right', fontSize: 9, fill: OVERPAY_COLOR }} />
          <ReferenceLine y={30}  stroke={OVERPAY_COLOR}  strokeDasharray="3 3" strokeWidth={1} label={{ value: '+30%', position: 'right', fontSize: 9, fill: OVERPAY_COLOR }} />
          <ReferenceLine y={-15} stroke={UNDERPAY_COLOR} strokeDasharray="3 3" strokeWidth={1} label={{ value: '-15%', position: 'right', fontSize: 9, fill: UNDERPAY_COLOR }} />
          <Bar
            dataKey="avgDeviation"
            name="Avg Deviation %"
            radius={[2, 2, 0, 0]}
            maxBarSize={28}
            fill={DEV_POS_COLOR}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Public component ─────────────────────────────────────────────────────────

/**
 * CategoryBreakdown — dual chart: financial exposure + average deviation.
 * @param {{ byCategory: CategoryReport[], className?: string }} props
 */
export default function CategoryBreakdown({ byCategory, className = '' }) {
  if (!byCategory?.length) return null

  // Limit to top 12 by overpayment to keep the chart readable
  const data = byCategory
    .slice(0, 12)
    .map(c => ({
      label:        abbrev(c.label),
      fullLabel:    c.label,
      overpayAED:   c.overpayAED ?? 0,
      underpayAED:  c.underpayAED ?? 0,
      avgDeviation: c.avgDeviation ?? 0,
      itemCount:    c.itemCount,
    }))

  return (
    <div className={`card ${className}`}>
      <h3 className="text-sm font-semibold text-slate-700 mb-5">Category Analysis</h3>
      <div className="grid md:grid-cols-2 gap-6">
        <FinancialBars data={data} />
        <DeviationBars data={data} />
      </div>
    </div>
  )
}
