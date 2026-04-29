import { createContext, useContext, useState, useEffect } from 'react'

const AppContext = createContext(null)

const STORAGE_KEY = 'aldar_procurement_files'

export function AppProvider({ children }) {
  const [benchmarkFile, setBenchmarkFile] = useState(null)
  const [projectFile, setProjectFile]     = useState(null)

  // Restore metadata from localStorage on mount (not the file binary itself)
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
      if (stored.benchmark) setBenchmarkFile(stored.benchmark)
      if (stored.project)   setProjectFile(stored.project)
    } catch {
      /* ignore malformed storage */
    }
  }, [])

  function persistFile(key, meta) {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    stored[key] = meta
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
  }

  function clearFile(key) {
    if (key === 'benchmark') setBenchmarkFile(null)
    if (key === 'project')   setProjectFile(null)
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    delete stored[key]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
  }

  function handleBenchmarkUpload(meta) {
    setBenchmarkFile(meta)
    persistFile('benchmark', meta)
  }

  function handleProjectUpload(meta) {
    setProjectFile(meta)
    persistFile('project', meta)
  }

  return (
    <AppContext.Provider
      value={{
        benchmarkFile,
        projectFile,
        handleBenchmarkUpload,
        handleProjectUpload,
        clearFile,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}
