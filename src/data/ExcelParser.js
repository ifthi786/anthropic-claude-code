/**
 * ExcelParser
 * Reads the Benchmark_Master.xlsx File object and returns structured data.
 *
 * Sheet layout (confirmed against actual file):
 *   10_LOCATION_LAYER   – individual item pricing (255 rows)
 *   11_LOCATION_DICT    – verbatim→normalised location map (34 rows)
 *   12_LOCATION_BENCHMARK – aggregated benchmarks by category+location (102 rows)
 *   13_SIDE_BY_SIDE     – project comparison (multi-header, 99 item rows)
 */

import * as XLSX from 'xlsx'

// ─── Column maps (indices into the raw header:1 array) ────────────────────────

const COL_10 = {
  itemId:        0,
  category:      1,
  project:       2,
  location:      3, // verbatim – mostly empty
  normLocation:  4,
  model:         5,
  finish:        6,
  rate:          7,
  unit:          8,
  priceFlag:     9,
  itemTag:       10,
}

const COL_11 = {
  originalLocation: 0,
  normLocation:     1,
  family:           2,
  itemCount:        3,
  rationale:        4,
}

const COL_12 = {
  benchmarkId:   0,
  category:      1,
  normLocation:  2,
  occurrences:   3,
  avgRate:       4,
  minRate:       5,
  maxRate:       6,
  projects:      7,
  priceIndex:    8,
}

// Sheet 13: project groups start at cols 1, 9, 17 (8 cols each)
const SBS_PROJECT_OFFSETS = [
  { project: null, startCol: 1 }, // name filled from row-0
  { project: null, startCol: 9 },
  { project: null, startCol: 17 },
]
const SBS_SUB = { brand: 0, supplier: 1, pictures: 2, area: 3, description: 4, finish: 5, model: 6, rate: 7 }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toNum(v) {
  const n = Number(v)
  return isNaN(n) ? null : n
}

function toStr(v) {
  if (v === null || v === undefined) return ''
  return String(v).trim()
}

function readWorkbook(arrayBuffer) {
  const data = new Uint8Array(arrayBuffer)
  return XLSX.read(data, { type: 'array', cellDates: true })
}

function sheetRows(wb, sheetName) {
  const ws = wb.Sheets[sheetName]
  if (!ws) throw new Error(`Sheet "${sheetName}" not found in workbook.`)
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
}

// ─── Sheet parsers ────────────────────────────────────────────────────────────

function parseLocationLayer(rows) {
  return rows
    .slice(1) // skip header
    .filter(r => toStr(r[COL_10.itemId]))
    .map(r => ({
      itemId:       toStr(r[COL_10.itemId]),
      category:     toStr(r[COL_10.category]),
      project:      toStr(r[COL_10.project]),
      location:     toStr(r[COL_10.location]),
      normLocation: toStr(r[COL_10.normLocation]),
      model:        toStr(r[COL_10.model]),
      finish:       toStr(r[COL_10.finish]),
      rate:         toNum(r[COL_10.rate]),
      unit:         toStr(r[COL_10.unit]),
      priceFlag:    toStr(r[COL_10.priceFlag]),
      itemTag:      toStr(r[COL_10.itemTag]),
    }))
}

function parseLocationDict(rows) {
  return rows
    .slice(1)
    .filter(r => toStr(r[COL_11.normLocation]))
    .map(r => ({
      originalLocation: toStr(r[COL_11.originalLocation]),
      normLocation:     toStr(r[COL_11.normLocation]),
      family:           toStr(r[COL_11.family]),
      itemCount:        toNum(r[COL_11.itemCount]) ?? 0,
      rationale:        toStr(r[COL_11.rationale]),
    }))
}

function parseLocationBenchmark(rows) {
  return rows
    .slice(1)
    .filter(r => toStr(r[COL_12.benchmarkId]))
    .map(r => ({
      benchmarkId:  toStr(r[COL_12.benchmarkId]),
      category:     toStr(r[COL_12.category]),
      normLocation: toStr(r[COL_12.normLocation]),
      occurrences:  toNum(r[COL_12.occurrences]) ?? 0,
      avgRate:      toNum(r[COL_12.avgRate]),
      minRate:      toNum(r[COL_12.minRate]),
      maxRate:      toNum(r[COL_12.maxRate]),
      // "Al Marjan, Nobu" → ['Al Marjan', 'Nobu']
      projects:     toStr(r[COL_12.projects])
                      .split(',')
                      .map(p => p.trim())
                      .filter(Boolean),
      priceIndex:   toNum(r[COL_12.priceIndex]),
    }))
}

function parseSideBySide(rows) {
  if (rows.length < 3) return []

  // Row 0: project name at each group's startCol
  const projectNames = SBS_PROJECT_OFFSETS.map(g => toStr(rows[0][g.startCol]) || `Project_${g.startCol}`)

  const comparisons = []

  for (let i = 2; i < rows.length; i++) {
    const row = rows[i]
    const itemType = toStr(row[0])
    if (!itemType) continue

    for (let p = 0; p < SBS_PROJECT_OFFSETS.length; p++) {
      const base = SBS_PROJECT_OFFSETS[p].startCol
      const brand = toStr(row[base + SBS_SUB.brand])
      // Skip placeholder dashes
      if (brand === '—' || brand === '-' || brand === '') continue

      comparisons.push({
        itemType,
        project:     projectNames[p],
        brand,
        supplier:    toStr(row[base + SBS_SUB.supplier]),
        area:        toStr(row[base + SBS_SUB.area]),
        description: toStr(row[base + SBS_SUB.description]),
        finish:      toStr(row[base + SBS_SUB.finish]),
        model:       toStr(row[base + SBS_SUB.model]),
        rate:        toNum(row[base + SBS_SUB.rate]),
      })
    }
  }

  return comparisons
}

// ─── Public class ─────────────────────────────────────────────────────────────

export class ExcelParser {
  /**
   * Parse a File object (.xlsx) and return structured benchmark data.
   * @param {File} file
   * @returns {Promise<ParsedData>}
   */
  static async parse(file) {
    if (!file) throw new Error('No file provided.')

    const arrayBuffer = await file.arrayBuffer()
    const wb = readWorkbook(arrayBuffer)

    const sheetNames = new Set(wb.SheetNames)
    const required = ['10_LOCATION_LAYER', '11_LOCATION_DICT', '12_LOCATION_BENCHMARK', '13_SIDE_BY_SIDE']
    const missing = required.filter(s => !sheetNames.has(s))
    if (missing.length) {
      throw new Error(`Missing required sheets: ${missing.join(', ')}`)
    }

    const locationLayer  = parseLocationLayer(sheetRows(wb, '10_LOCATION_LAYER'))
    const locationDict   = parseLocationDict(sheetRows(wb, '11_LOCATION_DICT'))
    const benchmarks     = parseLocationBenchmark(sheetRows(wb, '12_LOCATION_BENCHMARK'))
    const sideBySide     = parseSideBySide(sheetRows(wb, '13_SIDE_BY_SIDE'))

    return { locationLayer, locationDict, benchmarks, sideBySide }
  }

  /**
   * Parse only the sheet names without full processing — useful for quick validation.
   * @param {File} file
   * @returns {Promise<string[]>}
   */
  static async getSheetNames(file) {
    const ab = await file.arrayBuffer()
    const wb = XLSX.read(new Uint8Array(ab), { type: 'array', bookSheets: true })
    return wb.SheetNames
  }
}
