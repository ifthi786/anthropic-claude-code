import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Cell, ResponsiveContainer, LabelList,
} from 'recharts'
import { FLAG } from '../../analysis/DeviationAnalyzer'

// Hex colours (Recharts needs hex, not Tailwind classes)
const FLAG_HEX = {
  [FLAG.OVERPRICED]:         '#ef4444',
  [FLAG.SLIGHTLY_EXPENSIVE]: '#f59e0b',
  [FLAG.COMPETITIVE]:        '#10b981',
  [FLAG.UNDERPRICED]:        '#3b82f6',
}

const FLAG_LABEL = {
  [FLAG.OVERPRICED]:         'Overpriced',
  [FLAG.SLIGHTLY_EXPENSIVE]: 'Slightly Expensive',
  [FLAG.COMPETITIVE]:        'Competitive',
  [FLAG.UNDERPRICED]:        'Underpriced',
}

const FLAG_ORDER = [FLAG.OVERPRICED, FLAG.SLIGHTLY_EXPENSIVE, FLAG.COMPETITIVE, FLAG.UNDERPRICED]

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const { name, value, pct } = payload[0].payload
  return (
    <div className="bg-white border border-slate-200 shadow-lg rounded-lg px-3 py-2 text-sm">
      <p className="font-semibold text-slate-800">{name}</p>
      <p className="text-slate-600">{value} items · {pct}%</p>
    </div>
  )
}

function CustomLabel({ x, y, width, value }) {
  if (!value) return null
  return (
    <text x={x + width + 6} y={y + 14} fontSize={11} fill="#64748b">
      {value}
    </text>
  )
}

/**
 * FlagBreakdownChart — horizontal bar chart showing flag distribution.
 * @param {{ flagCounts: Record<string,number>, className?: string }} props
 */
export default function FlagBreakdownChart({ flagCounts, className = '' }) {
  if (!flagCounts) return null

  const total = FLAG_ORDER.reduce((s, f) => s + (flagCounts[f] ?? 0), 0)
  if (total === 0) return (
    <div className={`card flex items-center justify-center h-32 text-slate-400 text-sm ${className}`}>
      No flag data available
    </div>
  )

  const data = FLAG_ORDER
    .filter(f => (flagCounts[f] ?? 0) > 0)
    .map(f => ({
      name:  FLAG_LABEL[f],
      flag:  f,
      value: flagCounts[f] ?? 0,
      pct:   Math.round(((flagCounts[f] ?? 0) / total) * 100),
      label: `${flagCounts[f] ?? 0}  (${Math.round(((flagCounts[f] ?? 0) / total) * 100)}%)`,
    }))

  return (
    <div className={`card ${className}`}>
      <h3 className="text-sm font-semibold text-slate-700 mb-4">Flag Distribution</h3>
      <ResponsiveContainer width="100%" height={data.length * 52 + 20}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 80, left: 4, bottom: 0 }}
          barSize={28}
        >
          <CartesianGrid horizontal={false} stroke="#f1f5f9" />
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={130}
            tick={{ fontSize: 12, fill: '#475569' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {data.map((entry) => (
              <Cell key={entry.flag} fill={FLAG_HEX[entry.flag]} />
            ))}
            <LabelList content={<CustomLabel />} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
