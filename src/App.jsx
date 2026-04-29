import { useState } from 'react'
import { AppProvider } from './context/AppContext'
import TabNavigation from './components/TabNavigation'
import BenchmarkManagement from './components/BenchmarkManagement'
import ProjectAnalysis from './components/ProjectAnalysis'
import aldarLogo from '../aldar logo.jpeg'

function Dashboard() {
  const [activeTab, setActiveTab] = useState('benchmark')

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Top header bar ─────────────────────────────────────────────── */}
      <header className="bg-navy-500 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">

            {/* Logo + brand */}
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl overflow-hidden bg-white/10 flex items-center justify-center ring-1 ring-white/20">
                <img
                  src={aldarLogo}
                  alt="Aldar Properties"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                    e.currentTarget.parentElement.innerHTML =
                      '<span class="text-gold-400 font-bold text-sm">A</span>'
                  }}
                />
              </div>
              <div className="leading-tight">
                <p className="text-xs text-navy-200 font-medium tracking-widest uppercase">
                  Aldar Properties
                </p>
                <h1 className="text-base font-semibold text-white leading-none">
                  Procurement Benchmark Dashboard
                </h1>
              </div>
            </div>

            {/* Right-side meta */}
            <div className="hidden sm:flex items-center gap-3">
              <span className="status-badge bg-gold-500/20 text-gold-300 border border-gold-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-gold-400 inline-block" />
                UAE Projects
              </span>
              <span className="text-navy-300 text-xs">
                {new Date().toLocaleDateString('en-AE', { dateStyle: 'medium' })}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* ── Gold accent stripe ─────────────────────────────────────────── */}
      <div className="h-1 bg-gradient-to-r from-gold-500 via-gold-400 to-gold-500" />

      {/* ── Sub-header with tab navigation ────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <TabNavigation activeTab={activeTab} onChange={setActiveTab} />
        </div>
      </div>

      {/* ── Main content ───────────────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'benchmark' && <BenchmarkManagement />}
        {activeTab === 'analysis'  && <ProjectAnalysis />}
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between text-xs text-slate-400">
          <span>© {new Date().getFullYear()} Aldar Properties PJSC. Internal use only.</span>
          <span className="flex items-center gap-1.5">
            <LockIcon />
            Data stored locally — not transmitted externally
          </span>
        </div>
      </footer>
    </div>
  )
}

function LockIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0
           2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25
           2.25 0 0 0 2.25 2.25Z"
      />
    </svg>
  )
}

export default function App() {
  return (
    <AppProvider>
      <Dashboard />
    </AppProvider>
  )
}
