import { useState, useMemo, useCallback } from 'react'
import { FLAG, FLAG_TAILWIND } from '../../analysis/DeviationAnalyzer'
import { formatAED, toLabel } from '../../data/transforms'
import { BenchmarkMatcher } from '../../analysis/BenchmarkMatcher'

// ─── Constants ────────────────────────────────────────────────────────────────

const FLAG_ALL = '__all__'
const PAGE_SIZE = 25

const COLUMNS = [
  { key: 'itemId',       label: 'Item ID',       sortable: true,  width: 'w-28'  },
  { key: 'category',     label: 'Category',      sortable: true,  width: 'w-40'  },
  { key: 'description',  label: 'Description',   sortable: false, width: ''      },
  { key: 'rate',         label: 'BOQ Rate',       sortable: true,  width: 'w-28'  },
  { key: 'benchmarkAvg', label: 'Benchmark Avg',  sortable: true,  width: 'w-28'  },
  { key: 'deviation',    label: 'Deviation %',    sortable: true,  width: 'w-28'  },
  { key: 'flag',         label: 'Status',         sortable: true,  width: 'w-36'  },
  { key: 'confidence',   label: 'Confidence',     sortable: true,  width: 'w-24'  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normRow(r) {
  return {
    _raw:        r,
    itemId:      r.item.itemId ?? '',
    description: r.item.description ?? '',
    category:    r.matchResult?.category ?? '',
    rate:        r.item.rate ?? null,
    benchmarkAvg: r.benchmark?.avgRate ?? null,
    deviation:   r.deviation ?? null,
    flag:        r.flag ?? null,
    confidence:  r.matchResult?.confidence ?? null,
    location:    r.item.location ?? '',
    unit:        r.item.unit ?? '',
    quantity:    r.item.quantity ?? 1,
    percentile:  r.percentile ?? null,
    withinRange: r.withinRange ?? null,
    reliable:    r.reliable ?? false,
    reasoning:   r.reasoning ?? '',
    minRate:     r.benchmark?.minRate ?? null,
    maxRate:     r.benchmark?.maxRate ?? null,
  }
}

function sortRows(rows, field, dir) {
  return [...rows].sort((a, b) => {
    const av = a[field] ?? (typeof a[field] === 'number' ? -Infinity : '')
    const bv = b[field] ?? (typeof b[field] === 'number' ? -Infinity : '')
    if (typeof av === 'number' && typeof bv === 'number') {
      return dir === 'asc' ? av - bv : bv - av
    }
    return dir === 'asc'
      ? String(av).localeCompare(String(bv))
      : String(bv).localeCompare(String(av))
  })
}

function devColour(dev) {
  if (dev === null) return 'text-slate-400'
  if (dev > 30)  return 'text-red-600 font-semibold'
  if (dev > 15)  return 'text-amber-600 font-medium'
  if (dev < -15) return 'text-blue-600 font-medium'
  return 'text-emerald-600'
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SortIcon({ field, sortField, sortDir }) {
  if (field !== sortField) return <span className="text-slate-300 ml-1">↕</span>
  return <span className="text-navy-500 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
}

function FlagBadge({ flag }) {
  if (!flag) return <span className="text-slate-400 text-xs">Unmatched</span>
  const tw = FLAG_TAILWIND[flag] ?? {}
  return (
    <span className={`status-badge ${tw.bg} ${tw.text} border ${tw.border} text-xs`}>
      <span className={`w-1.5 h-1.5 rounded-full ${tw.dot}`} />
      {flag.replace(/_/g, ' ')}
    </span>
  )
}

function ConfBadge({ confidence }) {
  if (confidence === null) return <span className="text-slate-400 text-xs">—</span>
  const label = BenchmarkMatcher.confidenceLabel(confidence)
  const cls   = confidence >= 0.8 ? 'text-emerald-600' : confidence >= 0.55 ? 'text-amber-600' : 'text-red-500'
  return <span className={`text-xs font-medium ${cls}`}>{label} ({(confidence * 100).toFixed(0)}%)</span>
}

function ExpandedRow({ row }) {
  return (
    <tr>
      <td colSpan={COLUMNS.length + 1} className="bg-slate-50 border-b border-slate-200 px-6 py-3">
        <div className="grid sm:grid-cols-3 gap-4 text-xs">
          <div>
            <p className="font-semibold text-slate-600 mb-1">Item Details</p>
            <dl className="space-y-0.5 text-slate-500">
              <div className="flex gap-2"><dt>Unit:</dt><dd className="text-slate-700">{row.unit || '—'}</dd></div>
              <div className="flex gap-2"><dt>Qty:</dt><dd className="text-slate-700">{row.quantity}</dd></div>
              <div className="flex gap-2"><dt>Location:</dt><dd className="text-slate-700">{row.location || '—'}</dd></div>
              <div className="flex gap-2"><dt>Total value:</dt><dd className="text-slate-700">{formatAED(row.rate * row.quantity)}</dd></div>
            </dl>
          </div>
          <div>
            <p className="font-semibold text-slate-600 mb-1">Benchmark Range</p>
            <dl className="space-y-0.5 text-slate-500">
              <div className="flex gap-2"><dt>Min:</dt><dd className="text-slate-700">{formatAED(row.minRate)}</dd></div>
              <div className="flex gap-2"><dt>Avg:</dt><dd className="text-slate-700">{formatAED(row.benchmarkAvg)}</dd></div>
              <div className="flex gap-2"><dt>Max:</dt><dd className="text-slate-700">{formatAED(row.maxRate)}</dd></div>
              <div className="flex gap-2"><dt>Percentile:</dt><dd className="text-slate-700">{row.percentile !== null ? `${Math.min(100, Math.max(0, row.percentile)).toFixed(0)}th` : '—'}</dd></div>
              <div className="flex gap-2"><dt>Reliable:</dt><dd className={row.reliable ? 'text-emerald-600' : 'text-amber-600'}>{row.reliable ? 'Yes' : 'Low data'}</dd></div>
            </dl>
          </div>
          <div>
            <p className="font-semibold text-slate-600 mb-1">Reasoning</p>
            <p className="text-slate-600 leading-relaxed">{row.reasoning || '—'}</p>
          </div>
        </div>
      </td>
    </tr>
  )
}

// ─── Toolbar ──────────────────────────────────────────────────────────────────

function Toolbar({ categories, search, setSearch, filterCat, setFilterCat, filterFlag, setFilterFlag, total, filtered }) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-slate-200 bg-slate-50 rounded-t-2xl">
      {/* Search */}
      <div className="relative flex-1 min-w-40">
        <input
          type="text"
          placeholder="Search description or item ID…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-300 bg-white"
        />
        <span className="absolute left-2.5 top-2 text-slate-400 text-xs">🔍</span>
      </div>

      {/* Category filter */}
      <select
        value={filterCat}
        onChange={e => setFilterCat(e.target.value)}
        className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-navy-300"
      >
        <option value={FLAG_ALL}>All categories</option>
        {categories.map(c => (
          <option key={c} value={c}>{toLabel(c)}</option>
        ))}
      </select>

      {/* Flag filter */}
      <select
        value={filterFlag}
        onChange={e => setFilterFlag(e.target.value)}
        className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-navy-300"
      >
        <option value={FLAG_ALL}>All statuses</option>
        <option value={FLAG.OVERPRICED}>Overpriced</option>
        <option value={FLAG.SLIGHTLY_EXPENSIVE}>Slightly Expensive</option>
        <option value={FLAG.COMPETITIVE}>Competitive</option>
        <option value={FLAG.UNDERPRICED}>Underpriced</option>
        <option value="__unmatched__">Unmatched</option>
      </select>

      <span className="text-xs text-slate-400 ml-auto shrink-0">
        {filtered} / {total} items
      </span>
    </div>
  )
}

// ─── Public component ─────────────────────────────────────────────────────────

/**
 * DetailedTable — sortable, filterable, expandable table of all analysed items.
 * @param {{ results: DeviationResult[], className?: string }} props
 */
export default function DetailedTable({ results, className = '' }) {
  const [sortField, setSortField] = useState('deviation')
  const [sortDir,   setSortDir]   = useState('desc')
  const [search,    setSearch]    = useState('')
  const [filterCat, setFilterCat] = useState(FLAG_ALL)
  const [filterFlag,setFilterFlag]= useState(FLAG_ALL)
  const [expanded,  setExpanded]  = useState(null)
  const [page,      setPage]      = useState(1)

  const rows = useMemo(() => (results ?? []).map(normRow), [results])

  const categories = useMemo(
    () => [...new Set(rows.map(r => r.category).filter(Boolean))].sort(),
    [rows]
  )

  const filtered = useMemo(() => {
    let out = rows
    if (search) {
      const q = search.toLowerCase()
      out = out.filter(r =>
        r.description.toLowerCase().includes(q) ||
        r.itemId.toLowerCase().includes(q)
      )
    }
    if (filterCat !== FLAG_ALL) {
      out = out.filter(r => r.category === filterCat)
    }
    if (filterFlag !== FLAG_ALL) {
      if (filterFlag === '__unmatched__') out = out.filter(r => !r.flag)
      else                               out = out.filter(r => r.flag === filterFlag)
    }
    return sortRows(out, sortField, sortDir)
  }, [rows, search, filterCat, filterFlag, sortField, sortDir])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const pageRows   = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const handleSort = useCallback((field) => {
    if (field === sortField) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('desc')
    }
    setPage(1)
  }, [sortField])

  const toggleExpand = useCallback((idx) => {
    setExpanded(prev => prev === idx ? null : idx)
  }, [])

  if (!results?.length) return null

  return (
    <div className={`card p-0 overflow-hidden ${className}`}>
      <Toolbar
        categories={categories}
        search={search}        setSearch={v => { setSearch(v); setPage(1) }}
        filterCat={filterCat}  setFilterCat={v => { setFilterCat(v); setPage(1) }}
        filterFlag={filterFlag} setFilterFlag={v => { setFilterFlag(v); setPage(1) }}
        total={rows.length}
        filtered={filtered.length}
      />

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left border-b border-slate-200">
              <th className="px-4 py-2.5 w-8" />
              {COLUMNS.map(col => (
                <th
                  key={col.key}
                  className={`px-4 py-2.5 font-medium text-slate-500 whitespace-nowrap select-none
                    ${col.width} ${col.sortable ? 'cursor-pointer hover:text-slate-700' : ''}`}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  {col.label}
                  {col.sortable && <SortIcon field={col.key} sortField={sortField} sortDir={sortDir} />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pageRows.map((row, i) => {
              const absIdx   = (page - 1) * PAGE_SIZE + i
              const isExpand = expanded === absIdx
              return [
                <tr
                  key={`row-${absIdx}`}
                  className="hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() => toggleExpand(absIdx)}
                >
                  <td className="px-4 py-2.5 text-slate-400 text-xs">
                    {isExpand ? '▾' : '▸'}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 font-mono text-xs truncate max-w-28">
                    {row.itemId || '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    {row.category
                      ? <span className="text-xs bg-navy-50 text-navy-600 font-mono px-1.5 py-0.5 rounded">{row.category}</span>
                      : <span className="text-slate-400 text-xs">—</span>
                    }
                  </td>
                  <td className="px-4 py-2.5 text-slate-700 max-w-xs">
                    <span className="line-clamp-1 text-xs">{row.description}</span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-700 text-right tabular-nums text-xs">
                    {formatAED(row.rate, { showUnit: false })}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 text-right tabular-nums text-xs">
                    {row.benchmarkAvg !== null ? formatAED(row.benchmarkAvg, { showUnit: false }) : '—'}
                  </td>
                  <td className={`px-4 py-2.5 text-right tabular-nums text-xs ${devColour(row.deviation)}`}>
                    {row.deviation !== null
                      ? `${row.deviation > 0 ? '+' : ''}${row.deviation.toFixed(1)}%`
                      : '—'}
                  </td>
                  <td className="px-4 py-2.5"><FlagBadge flag={row.flag} /></td>
                  <td className="px-4 py-2.5"><ConfBadge confidence={row.confidence} /></td>
                </tr>,
                isExpand && <ExpandedRow key={`exp-${absIdx}`} row={row} />,
              ]
            })}

            {filtered.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length + 1} className="px-6 py-8 text-center text-slate-400 text-sm">
                  No items match the current filters
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
          <span className="text-xs text-slate-500">
            Page {page} of {totalPages} · {filtered.length} items
          </span>
          <div className="flex gap-1">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="px-3 py-1 text-xs rounded-lg border border-slate-200 bg-white disabled:opacity-40 hover:bg-slate-50"
            >
              ← Prev
            </button>
            {/* Page number pills (max 5 shown) */}
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`px-3 py-1 text-xs rounded-lg border ${
                    page === p
                      ? 'bg-navy-500 text-white border-navy-500'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  {p}
                </button>
              )
            })}
            <button
              disabled={page === totalPages}
              onClick={() => setPage(p => p + 1)}
              className="px-3 py-1 text-xs rounded-lg border border-slate-200 bg-white disabled:opacity-40 hover:bg-slate-50"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
