/**
 * Analysis layer barrel export.
 *
 * @example
 * import { BOQParser, BenchmarkMatcher, DeviationAnalyzer, ReportGenerator, saveAnalysis } from '../analysis'
 */

export { BOQParser }          from './BOQParser'
export { BenchmarkMatcher }   from './BenchmarkMatcher'
export { DeviationAnalyzer, FLAG, FLAG_COLOR, FLAG_TAILWIND } from './DeviationAnalyzer'
export { ReportGenerator }    from './ReportGenerator'

export {
  saveAnalysis,
  loadCurrentAnalysis,
  loadAnalysisHistory,
  clearCurrentAnalysis,
  clearAnalysisHistory,
  exportAnalysisJSON,
  getAnalysisContext,
} from './StorageManager'
