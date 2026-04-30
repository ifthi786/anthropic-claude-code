import { useState } from 'react'
import { useApp } from '../context/AppContext'
import FileUpload from './FileUpload'
import { formatAED, toLabel } from '../data/transforms'

// ─── Category product icon map ────────────────────────────────────────────────

const CATEGORY_META = {
  BASIN_MIXER:           { emoji: '🚿', label: 'Basin Mixer',           color: 'bg-blue-50 border-blue-200' },
  FREESTANDING_BASIN:    { emoji: '🪣', label: 'Freestanding Basin',    color: 'bg-sky-50 border-sky-200' },
  UNDERCOUNTER_BASIN:    { emoji: '🪣', label: 'Undercounter Basin',    color: 'bg-cyan-50 border-cyan-200' },
  SEMI_RECESSED_BASIN:   { emoji: '🪣', label: 'Semi-Recessed Basin',   color: 'bg-teal-50 border-teal-200' },
  WASH_BASIN_GENERIC:    { emoji: '🪣', label: 'Wash Basin',            color: 'bg-sky-50 border-sky-200' },
  WC_GENERIC:            { emoji: '🚽', label: 'WC (Generic)',          color: 'bg-slate-50 border-slate-200' },
  WC_SEAT:               { emoji: '🚽', label: 'WC Seat',               color: 'bg-slate-50 border-slate-200' },
  WALL_HUNG_WC:          { emoji: '🚽', label: 'Wall-Hung WC',          color: 'bg-zinc-50 border-zinc-200' },
  WALL_HUNG_BASIN:       { emoji: '🪣', label: 'Wall-Hung Basin',       color: 'bg-blue-50 border-blue-200' },
  SMART_WC:              { emoji: '🤖', label: 'Smart WC',              color: 'bg-violet-50 border-violet-200' },
  URINAL:                { emoji: '🚻', label: 'Urinal',                color: 'bg-indigo-50 border-indigo-200' },
  SHOWER_HEAD:           { emoji: '🚿', label: 'Shower Head',           color: 'bg-blue-50 border-blue-200' },
  SHOWER_MIXER:          { emoji: '🚿', label: 'Shower Mixer',          color: 'bg-blue-50 border-blue-200' },
  SHOWER_SET:            { emoji: '🚿', label: 'Shower Set',            color: 'bg-sky-50 border-sky-200' },
  FREESTANDING_BATHTUB:  { emoji: '🛁', label: 'Freestanding Bathtub',  color: 'bg-purple-50 border-purple-200' },
  HAND_SHOWER:           { emoji: '🚿', label: 'Hand Shower',           color: 'bg-blue-50 border-blue-200' },
  WALL_SPOUT:            { emoji: '🔧', label: 'Wall Spout',            color: 'bg-gray-50 border-gray-200' },
  BATH_MIXER:            { emoji: '🛁', label: 'Bath Mixer',            color: 'bg-purple-50 border-purple-200' },
  KITCHEN_MIXER:         { emoji: '🍳', label: 'Kitchen Mixer',         color: 'bg-orange-50 border-orange-200' },
  TOWEL_RAIL:            { emoji: '🏮', label: 'Towel Rail',            color: 'bg-amber-50 border-amber-200' },
  TOILET_ROLL_HOLDER:    { emoji: '🧻', label: 'Toilet Roll Holder',    color: 'bg-yellow-50 border-yellow-200' },
  SOAP_DISPENSER:        { emoji: '🧴', label: 'Soap Dispenser',        color: 'bg-green-50 border-green-200' },
  MIRROR:                { emoji: '🪞', label: 'Mirror',                color: 'bg-rose-50 border-rose-200' },
  ACCESSORY_SET:         { emoji: '🔧', label: 'Accessory Set',         color: 'bg-gray-50 border-gray-200' },
}

function getCategoryMeta(cat) {
  return CATEGORY_META[cat] ?? { emoji: '📦', label: toLabel(cat), color: 'bg-slate-50 border-slate-200' }
}

export default function BenchmarkManagement() {
  const {
    benchmarkFile,
    benchmarkStore,
    validation,
    parsing,
    parseError,
    handleBenchmarkUpload,
    clearFile,
  } = useApp()

  return (
    <div className="grid gap-6">
      {/* Hero card */}
      <div className="card bg-gradient-to-r from-navy-500 to-navy-600 text-white border-0">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-white/10 rounded-xl">
            <DatabaseIcon />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Benchmark Master Data</h2>
            <p className="text-navy-100 text-sm mt-1 max-w-xl">
              Upload your consolidated benchmark file to establish unit-rate baselines across
              all UAE project categories. This data feeds all downstream project analyses.
            </p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 items-start">
        {/* Left: upload */}
        <div className="flex flex-col gap-4">
          <FileUpload
            id="benchmark-upload"
            title="Upload Benchmark Master"
            description="Upload the latest benchmark master .xlsx to update rate baselines."
            accentColor="gold"
            currentFile={benchmarkFile}
            onUpload={handleBenchmarkUpload}
            onClear={() => clearFile('benchmark')}
          />

          {/* Parse spinner */}
          {parsing && (
            <div className="flex items-center gap-3 bg-navy-50 border border-navy-200 rounded-xl px-4 py-3 text-sm text-navy-700">
              <SpinnerIcon />
              Parsing Excel sheets and building benchmark index…
            </div>
          )}

          {/* Parse error */}
          {parseError && !parsing && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
              <AlertIcon />
              <div>
                <p className="font-medium">Parse error</p>
                <p className="mt-0.5 text-red-600">{parseError}</p>
              </div>
            </div>
          )}

          {/* Validation report */}
          {validation && !parsing && (
            <ValidationCard report={validation} />
          )}
        </div>

        {/* Right: data stats / format guide */}
        <div className="flex flex-col gap-4">
          {benchmarkStore ? (
            <StoreStats store={benchmarkStore} />
          ) : (
            <FormatGuide />
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function ValidationCard({ report }) {
  const hasErrors   = report.errors.length > 0
  const hasWarnings = report.warnings.length > 0

  return (
    <div className={`card border ${hasErrors ? 'border-red-200 bg-red-50' : hasWarnings ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
      <div className="flex items-center gap-2 mb-3">
        {hasErrors
          ? <><AlertIcon className="text-red-500" /><span className="text-sm font-semibold text-red-700">Validation failed</span></>
          : hasWarnings
            ? <><WarningIcon className="text-amber-500" /><span className="text-sm font-semibold text-amber-700">Validated with warnings</span></>
            : <><CheckIcon className="text-emerald-500" /><span className="text-sm font-semibold text-emerald-700">Validation passed</span></>
        }
      </div>

      {/* Stats pills */}
      <div className="flex flex-wrap gap-2 mb-3">
        {Object.entries(report.stats)
          .filter(([k]) => ['locationLayer','locationDict','benchmarks','sideBySide'].includes(k))
          .map(([sheet, s]) => (
            <span key={sheet} className="status-badge bg-white border border-slate-200 text-slate-600">
              {toLabel(sheet)}: {s.rowCount ?? '—'} rows
            </span>
          ))
        }
        {report.stats.categories !== undefined && (
          <span className="status-badge bg-navy-50 border border-navy-200 text-navy-700">
            {report.stats.categories} categories
          </span>
        )}
        {report.stats.locations !== undefined && (
          <span className="status-badge bg-navy-50 border border-navy-200 text-navy-700">
            {report.stats.locations} locations
          </span>
        )}
        {report.stats.projects !== undefined && (
          <span className="status-badge bg-gold-50 border border-gold-200 text-gold-700">
            {report.stats.projects} projects
          </span>
        )}
      </div>

      {/* Error list */}
      {hasErrors && (
        <ul className="text-xs text-red-700 space-y-1 mb-2">
          {report.errors.map((e, i) => (
            <li key={i} className="flex gap-1.5"><span className="shrink-0">✕</span>{e.message}</li>
          ))}
        </ul>
      )}

      {/* Warning list */}
      {hasWarnings && (
        <ul className="text-xs text-amber-700 space-y-1">
          {report.warnings.map((w, i) => (
            <li key={i} className="flex gap-1.5"><span className="shrink-0">⚠</span>{w.message}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

function StoreStats({ store }) {
  const categories = store.getCategories()
  const locations  = store.getLocations()
  const projects   = store.getProjects()
  const [selected, setSelected] = useState(null)

  const selectedSummary = selected ? store.getCategorySummary(selected) : null

  return (
    <div className="flex flex-col gap-4">
      {/* KPI row */}
      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="Categories" value={categories.length} icon="📦" />
        <KpiCard label="Locations"  value={locations.length}  icon="📍" />
        <KpiCard label="Projects"   value={projects.length}   icon="🏗" />
      </div>

      {/* Projects */}
      <div className="card">
        <h4 className="text-sm font-semibold text-slate-700 mb-2">Indexed Projects</h4>
        <div className="flex flex-wrap gap-2">
          {projects.map(p => (
            <span key={p} className="status-badge bg-navy-50 border border-navy-200 text-navy-700">{p}</span>
          ))}
        </div>
      </div>

      {/* Category detail panel */}
      {selected && selectedSummary && (
        <CategoryDetailCard
          category={selected}
          summary={selectedSummary}
          store={store}
          onClose={() => setSelected(null)}
        />
      )}

      {/* Product category grid */}
      <div className="card">
        <h4 className="text-sm font-semibold text-slate-700 mb-3">
          All Products — click to view rates
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-96 overflow-y-auto pr-1">
          {categories.map(cat => {
            const meta    = getCategoryMeta(cat)
            const summary = store.getCategorySummary(cat)
            return (
              <button
                key={cat}
                onClick={() => setSelected(selected === cat ? null : cat)}
                className={[
                  'flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center',
                  'hover:shadow-md transition-all duration-150 cursor-pointer',
                  selected === cat
                    ? 'border-navy-400 bg-navy-50 shadow-md ring-2 ring-navy-300'
                    : `${meta.color} hover:border-navy-300`,
                ].join(' ')}
              >
                <span className="text-2xl">{meta.emoji}</span>
                <span className="text-xs font-medium text-slate-700 leading-tight">{meta.label}</span>
                {summary && (
                  <span className="text-[10px] text-slate-500 font-mono">
                    {formatAED(summary.overallAvg)} avg
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function CategoryDetailCard({ category, summary, store, onClose }) {
  const meta      = getCategoryMeta(category)
  const locations = store.getLocations()

  // Get per-location rates for this category
  const locationRates = locations
    .map(loc => {
      const benchmarks = store.findByCategory(category).filter(r => r.normLocation === loc)
      if (!benchmarks.length) return null
      const avg = benchmarks.reduce((s, r) => s + (r.avgRate ?? 0), 0) / benchmarks.length
      return { location: loc, avgRate: avg, count: benchmarks.length }
    })
    .filter(Boolean)
    .sort((a, b) => b.avgRate - a.avgRate)

  return (
    <div className="card border-navy-200 bg-navy-50">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl border flex items-center justify-center text-2xl ${meta.color}`}>
            {meta.emoji}
          </div>
          <div>
            <h4 className="text-sm font-semibold text-navy-800">{meta.label}</h4>
            <p className="text-xs text-navy-500 font-mono">{category}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 p-1 rounded"
        >✕</button>
      </div>

      {/* Rate summary */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {[
          { label: 'Avg Rate',  value: formatAED(summary.overallAvg) },
          { label: 'Min Rate',  value: formatAED(summary.overallMin) },
          { label: 'Max Rate',  value: formatAED(summary.overallMax) },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-lg p-2 text-center border border-navy-100">
            <p className="text-[10px] text-slate-500">{label}</p>
            <p className="text-xs font-semibold text-navy-700 mt-0.5">{value}</p>
          </div>
        ))}
      </div>

      {/* Per-location rates */}
      {locationRates.length > 0 && (
        <>
          <p className="text-[10px] font-semibold text-navy-600 uppercase tracking-wide mb-1.5">
            Rate by Location
          </p>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {locationRates.map(({ location, avgRate }) => {
              const pct = summary.overallMax > 0 ? (avgRate / summary.overallMax) * 100 : 0
              return (
                <div key={location} className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-600 w-28 shrink-0 truncate">{location}</span>
                  <div className="flex-1 bg-navy-100 rounded-full h-1.5">
                    <div
                      className="bg-navy-400 h-1.5 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-navy-700 w-20 text-right shrink-0">
                    {formatAED(avgRate)}
                  </span>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

function KpiCard({ label, value, icon }) {
  return (
    <div className="card text-center py-4">
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-2xl font-bold text-navy-500">{value}</div>
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
    </div>
  )
}

function StatRow({ label, value }) {
  return (
    <>
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-800">{value}</dd>
    </>
  )
}

function FormatGuide() {
  return (
    <div className="card border-gold-200 bg-gold-50">
      <h4 className="text-sm font-semibold text-gold-700 mb-3 flex items-center gap-2">
        <InfoIcon />
        Expected Sheets
      </h4>
      <ul className="text-sm text-gold-800 space-y-2">
        {[
          ['10_LOCATION_LAYER',    'Individual item pricing (Item ID, Category, Project, Rate…)'],
          ['11_LOCATION_DICT',     'Location normalisation map (verbatim → normalised)'],
          ['12_LOCATION_BENCHMARK','Aggregated benchmarks by category & location'],
          ['13_SIDE_BY_SIDE',      'Project-by-project comparison table'],
        ].map(([sheet, desc]) => (
          <li key={sheet}>
            <span className="font-mono text-xs bg-gold-200 text-gold-900 px-1.5 py-0.5 rounded mr-2">{sheet}</span>
            {desc}
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── Icons ─────────────────────────────────────────────────────────────────────

function DatabaseIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75
           4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5
           5.625c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125"
      />
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg className="w-4 h-4 shrink-0 animate-spin text-navy-500" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z" />
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

function WarningIcon({ className = 'text-amber-500' }) {
  return (
    <svg className={`w-4 h-4 shrink-0 ${className}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874
           1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
      />
    </svg>
  )
}

function CheckIcon({ className = 'text-emerald-500' }) {
  return (
    <svg className={`w-4 h-4 shrink-0 ${className}`} fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
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
