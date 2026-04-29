import { useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, Cell,
} from 'recharts'
import { formatAED, toLabel } from '../../data/transforms'

// ─── Constants ────────────────────────────────────────────────────────────────

const PROJECT_COLORS = ['#003366', '#D4AF37', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildChartData(sideBySide, selectedType) {
  if (!sideBySide?.length) return []
  const items = selectedType
    ? sideBySide.filter(r => r.itemType === selectedType)
    : sideBySide

  // Group by project, average rate per itemType
  const projects = [...new Set(items.map(r => r.project))].sort()
  const types    = [...new Set(items.map(r => r.itemType))].sort()

  return types.map(type => {
    const row = { itemType: type, label: toLabel(type) }
    for (const proj of projects) {
      const matches = items.filter(r => r.project === proj && r.itemType === type)
      const rates   = matches.map(r => r.rate).filter(v => v !== null && v > 0)
      row[proj] = rates.length ? Math.round(rates.reduce((s, v) => s + v, 0) / rates.length) : null
    }
    return row
  })
}

function detectOutliers(data, projects) {
  const outliers = []
  for (const row of data) {
    const rates = projects.map(p => row[p]).filter(v => v !== null)
    if (rates.length < 2) continue
    const avg = rates.reduce((s, v) => s + v, 0) / rates.length
    for (const proj of projects) {
      const rate = row[proj]
      if (rate === null) continue
      const dev = ((rate - avg) / avg) * 100
      if (Math.abs(dev) > 25) {
        outliers.push({ type: row.label, project: proj, rate, avg, dev: Math.round(dev) })
      }
    }
  }
  return outliers.sort((a, b) => Math.abs(b.dev) - Math.abs(a.dev)).slice(0, 8)
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 shadow-lg rounded-xl px-3 py-2 text-xs min-w-40">
      <p className="font-semibold text-slate-800 mb-1.5">{label}</p>
      {payload.map(p => p.value != null && (
        <p key={p.dataKey} style={{ color: p.fill }} className="flex justify-between gap-4">
          <span>{p.dataKey}</span>
          <span className="font-medium">{formatAED(p.value)}</span>
        </p>
      ))}
    </div>
  )
}

// ─── Public component ─────────────────────────────────────────────────────────

/**
 * ProjectComparison — side-by-side rate comparison of projects in the benchmark.
 * Data source: benchmarkStore._raw.sideBySide (sheet 13 of Benchmark_Master.xlsx).
 *
 * @param {{ sideBySide: ProjectComparison[], className?: string }} props
 */
export default function ProjectComparison({ sideBySide, className = '' }) {
  const [selectedType, setSelectedType] = useState('')

  const projects  = useMemo(() => [...new Set((sideBySide ?? []).map(r => r.project))].sort(), [sideBySide])
  const itemTypes = useMemo(() => [...new Set((sideBySide ?? []).map(r => r.itemType))].sort(), [sideBySide])
  const chartData = useMemo(() => buildChartData(sideBySide, selectedType || null), [sideBySide, selectedType])
  const outliers  = useMemo(() => detectOutliers(chartData, projects), [chartData, projects])

  if (!sideBySide?.length || projects.length < 2) {
    return (
      <div className={`card flex flex-col items-center justify-center gap-2 h-36 text-center ${className}`}>
        <p className="text-sm text-slate-500">Project comparison requires benchmark data with 2+ projects</p>
        <p className="text-xs text-slate-400">Load the Benchmark Master to enable this view</p>
      </div>
    )
  }

  const displayData = chartData.slice(0, 15)

  return (
    <div className={`card ${className}`}>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">Project Rate Comparison</h3>
          <p className="text-xs text-slate-400 mt-0.5">{projects.join(' · ')} — benchmark data</p>
        </div>

        <select
          value={selectedType}
          onChange={e => setSelectedType(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-navy-300"
        >
          <option value="">All item types</option>
          {itemTypes.map(t => (
            <option key={t} value={t}>{toLabel(t)}</option>
          ))}
        </select>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={280}>
        <BarChart
          data={displayData}
          margin={{ top: 4, right: 8, left: 0, bottom: 60 }}
          barCategoryGap="20%"
        >
          <CartesianGrid vertical={false} stroke="#f1f5f9" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 9, fill: '#64748b' }}
            interval={0}
            angle={-40}
            textAnchor="end"
            height={64}
          />
          <YAxis
            tickFormatter={v => `${(v / 1000).toFixed(0)}K`}
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            width={40}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            iconType="square"
            iconSize={10}
            wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }}
          />
          {projects.map((proj, idx) => (
            <Bar
              key={proj}
              dataKey={proj}
              fill={PROJECT_COLORS[idx % PROJECT_COLORS.length]}
              radius={[2, 2, 0, 0]}
              maxBarSize={20}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>

      {/* Outlier table */}
      {outliers.length > 0 && (
        <div className="mt-5 border-t border-slate-200 pt-4">
          <h4 className="text-xs font-semibold text-slate-600 mb-3 flex items-center gap-2">
            <span className="text-amber-500">⚠</span>
            Rate Outliers (&gt;25% from cross-project average)
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="pb-1.5 font-medium">Item Type</th>
                  <th className="pb-1.5 font-medium">Project</th>
                  <th className="pb-1.5 font-medium text-right">Rate</th>
                  <th className="pb-1.5 font-medium text-right">Cross-proj avg</th>
                  <th className="pb-1.5 font-medium text-right">Deviation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {outliers.map((o, i) => (
                  <tr key={i} className="text-slate-600">
                    <td className="py-1">{o.type}</td>
                    <td className="py-1 font-medium">{o.project}</td>
                    <td className="py-1 text-right tabular-nums">{formatAED(o.rate)}</td>
                    <td className="py-1 text-right tabular-nums text-slate-400">{formatAED(o.avg)}</td>
                    <td className={`py-1 text-right tabular-nums font-semibold ${o.dev > 0 ? 'text-red-600' : 'text-blue-600'}`}>
                      {o.dev > 0 ? '+' : ''}{o.dev}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
