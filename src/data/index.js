/**
 * Data layer barrel export.
 * Import everything from here rather than individual files.
 *
 * @example
 * import { ExcelParser, BenchmarkStore, DataValidator, saveBenchmarkData } from '../data'
 */

export { ExcelParser }          from './ExcelParser'
export { BenchmarkStore }       from './BenchmarkStore'
export { DataValidator }        from './DataValidator'

export {
  saveBenchmarkData,
  loadBenchmarkData,
  clearBenchmarkData,
  getBenchmarkCacheInfo,
  getBenchmarkCacheSize,
} from './storage'

export {
  formatAED,
  toLabel,
  formatIndex,
  groupBy,
  sortBenchmarks,
  buildRateMatrix,
  getPriceFlagDistribution,
  buildProjectSummaries,
  compareRate,
  bandColour,
  filterReliable,
} from './transforms'
