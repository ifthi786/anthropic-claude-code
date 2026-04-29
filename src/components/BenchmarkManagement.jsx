import { useApp } from '../context/AppContext'
import FileUpload from './FileUpload'

export default function BenchmarkManagement() {
  const { benchmarkFile, handleBenchmarkUpload, clearFile } = useApp()

  return (
    <div className="grid gap-6">
      {/* Page intro */}
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

      {/* Upload zone */}
      <div className="max-w-2xl">
        <FileUpload
          id="benchmark-upload"
          title="Upload Benchmark Master"
          description="Upload the latest benchmark master .xlsx to update rate baselines."
          accentColor="gold"
          currentFile={benchmarkFile}
          onUpload={handleBenchmarkUpload}
          onClear={() => clearFile('benchmark')}
        />
      </div>

      {/* Guidance card */}
      <div className="card max-w-2xl border-gold-200 bg-gold-50">
        <h4 className="text-sm font-semibold text-gold-700 mb-3 flex items-center gap-2">
          <InfoIcon />
          Expected File Format
        </h4>
        <ul className="text-sm text-gold-800 space-y-1.5 list-disc list-inside">
          <li>Column A – Work Section / Trade</li>
          <li>Column B – Item Description</li>
          <li>Column C – Unit of Measure</li>
          <li>Column D – Benchmark Low Rate (AED)</li>
          <li>Column E – Benchmark High Rate (AED)</li>
          <li>Column F – Source / Reference Project</li>
        </ul>
      </div>
    </div>
  )
}

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
