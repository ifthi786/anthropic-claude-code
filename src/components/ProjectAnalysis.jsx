import { useApp } from '../context/AppContext'
import FileUpload from './FileUpload'

export default function ProjectAnalysis() {
  const { benchmarkFile, projectFile, handleProjectUpload, clearFile } = useApp()

  const ready = !!benchmarkFile && !!projectFile

  return (
    <div className="grid gap-6">
      {/* Page intro */}
      <div className="card bg-gradient-to-r from-gold-500 to-gold-600 text-white border-0">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-white/15 rounded-xl">
            <AnalysisIcon />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Project Quotation Analysis</h2>
            <p className="text-amber-50 text-sm mt-1 max-w-xl">
              Upload a project BOQ / quotation file. Rates will be benchmarked against the
              master data and flagged where they deviate beyond acceptable thresholds.
            </p>
          </div>
        </div>
      </div>

      {/* Prerequisite warning */}
      {!benchmarkFile && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 max-w-2xl">
          <WarningIcon />
          <p>
            No benchmark master is loaded. Switch to the{' '}
            <strong>Benchmark Management</strong> tab and upload a master file first.
          </p>
        </div>
      )}

      {/* Upload zone */}
      <div className="max-w-2xl">
        <FileUpload
          id="project-upload"
          title="Upload Project Quotation"
          description="Upload the contractor quotation or BOQ .xlsx for this project."
          accentColor="navy"
          currentFile={projectFile}
          onUpload={handleProjectUpload}
          onClear={() => clearFile('project')}
        />
      </div>

      {/* Ready state — placeholder for Prompt 2 analysis panel */}
      {ready && (
        <div className="card max-w-2xl border-emerald-200 bg-emerald-50 flex items-center gap-3">
          <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
            <CheckCircleIcon />
          </div>
          <div>
            <p className="text-sm font-semibold text-emerald-800">Both files loaded — ready to analyse</p>
            <p className="text-xs text-emerald-600 mt-0.5">
              Benchmark comparison engine will appear here in the next build step.
            </p>
          </div>
        </div>
      )}

      {/* Column guide */}
      <div className="card max-w-2xl border-navy-100 bg-navy-50">
        <h4 className="text-sm font-semibold text-navy-600 mb-3 flex items-center gap-2">
          <InfoIcon />
          Expected File Format
        </h4>
        <ul className="text-sm text-navy-800 space-y-1.5 list-disc list-inside">
          <li>Column A – Item Reference</li>
          <li>Column B – Item Description</li>
          <li>Column C – Unit of Measure</li>
          <li>Column D – Quantity</li>
          <li>Column E – Unit Rate (AED)</li>
          <li>Column F – Total Amount (AED)</li>
        </ul>
      </div>
    </div>
  )
}

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

function CheckCircleIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
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
