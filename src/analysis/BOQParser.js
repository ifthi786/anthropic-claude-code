/**
 * BOQParser
 * Parses a user-uploaded project quotation .xlsx file.
 *
 * Design goals:
 *   - Auto-detect the header row (handles BOQs that start at row 3, 5, etc.)
 *   - Map flexible column names to canonical fields via regex pattern lists
 *   - Skip blank rows and totals/sub-total rows
 *   - Never throw on partial data — emit warnings instead
 */

import * as XLSX from 'xlsx'

// ─── Column header recognition patterns (ordered: most specific → broadest) ──

const HEADER_PATTERNS = {
  itemId: [
    /^item\s*(id|no\.?|ref\.?|number|code)$/i,
    /^ref(erence)?\.?$/i,
    /^s\.?\s*no\.?$/i,
    /^serial\s*(no\.?)?$/i,
    /^#$/,
    /^no\.?$/i,
  ],
  description: [
    /^(item\s*)?description$/i,
    /^(scope|particulars|work\s*item|trade\s*item|item\s*name|item\s*title)$/i,
    /^desc\.?$/i,
    /^details?$/i,
  ],
  category: [
    /^(item\s*)?category$/i,
    /^(normalized\s*)?item\s*cat(egory)?$/i,
    /^(trade|type|work\s*section|section|division|group)$/i,
    /^cat\.?$/i,
  ],
  rate: [
    /^(unit\s*)?(rate|price|cost)\s*(\(aed\)|\(uae\s*dirham\))?$/i,
    /^aed\s*(rate|price|unit)?$/i,
    /^(rate|price|cost)\s*per\s*(unit|nr|each|ea)$/i,
    /^unit\s*(price|value)$/i,
    /^supply\s*(rate|price)$/i,
  ],
  unit: [
    /^unit(\s*of\s*measure(ment)?)?$/i,
    /^u\.?o\.?m\.?$/i,
    /^uom$/i,
    /^measure(ment)?$/i,
  ],
  quantity: [
    /^(qty|quantity)\.?$/i,
    /^no\.?\s*of\s*(units?|items?)$/i,
    /^count$/i,
    /^nos?\.?$/i,
  ],
  location: [
    /^(normalized\s*)?location$/i,
    /^area$/i,
    /^zone$/i,
    /^space(\s*type)?$/i,
    /^room(\s*type)?$/i,
    /^loc\.?$/i,
  ],
  model: [
    /^model(\s*no\.?|\s*number|\s*ref\.?)?$/i,
    /^(part|product)\s*(no\.?|code|ref\.?)$/i,
    /^sku$/i,
  ],
  finish: [
    /^finish$/i,
    /^colou?r$/i,
    /^material$/i,
  ],
}

// Canonical fields that should be present for a usable BOQ row
const REQUIRED_FIELDS = ['description', 'rate']

// Rows whose description matches these are skipped (totals, headers, etc.)
const SKIP_ROW_PATTERNS = [
  /^total(s)?$/i,
  /^sub.?total$/i,
  /^grand\s*total$/i,
  /^section\s*total$/i,
  /^sum$/i,
  /^carried\s*(forward|over)$/i,
]

// ─── Internal helpers ─────────────────────────────────────────────────────────

function toStr(v) {
  return (v === null || v === undefined) ? '' : String(v).trim()
}

function toNum(v) {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, ''))
  return isNaN(n) ? null : n
}

/**
 * Score a single cell value against all patterns for a field.
 * Returns the best match score (0 = no match, 1 = exact regex match).
 */
function scoreCell(value, patterns) {
  const str = toStr(value)
  if (!str) return 0
  for (const rx of patterns) {
    if (rx.test(str)) return 1
  }
  return 0
}

/**
 * Score a row as a potential header row.
 * Returns { score, mapping } where mapping = { field: colIndex }.
 */
function scoreHeaderRow(row) {
  const mapping = {}
  let score = 0

  for (const [field, patterns] of Object.entries(HEADER_PATTERNS)) {
    let bestCol = -1
    let bestScore = 0
    row.forEach((cell, ci) => {
      const s = scoreCell(cell, patterns)
      if (s > bestScore) { bestScore = s; bestCol = ci }
    })
    if (bestScore > 0) {
      mapping[field] = bestCol
      score += bestScore
    }
  }

  return { score, mapping }
}

/**
 * Find the header row within the first MAX_SCAN_ROWS rows.
 * Returns { headerRowIndex, mapping } or null.
 */
const MAX_SCAN_ROWS = 15

function detectHeader(rows) {
  let best = { score: 0, rowIndex: -1, mapping: {} }

  for (let i = 0; i < Math.min(rows.length, MAX_SCAN_ROWS); i++) {
    const { score, mapping } = scoreHeaderRow(rows[i])
    // Must match at least description+rate to be a valid header
    const hasRequired = REQUIRED_FIELDS.every(f => mapping[f] !== undefined)
    if (hasRequired && score > best.score) {
      best = { score, rowIndex: i, mapping }
    }
  }

  return best.rowIndex >= 0 ? best : null
}

/**
 * Determine if a data row should be skipped (blank or totals line).
 */
function shouldSkipRow(row, mapping) {
  // Fully blank
  const filled = row.filter(v => v !== '' && v !== null && v !== undefined).length
  if (filled === 0) return true

  // Description matches a "totals" pattern
  if (mapping.description !== undefined) {
    const desc = toStr(row[mapping.description])
    if (SKIP_ROW_PATTERNS.some(rx => rx.test(desc))) return true
  }

  return false
}

// ─── Public class ─────────────────────────────────────────────────────────────

export class BOQParser {
  /**
   * Parse a File object (.xlsx) representing a project quotation / BOQ.
   * @param {File} file
   * @param {{ sheetIndex?: number, sheetName?: string }} [opts]
   * @returns {Promise<BOQParseResult>}
   */
  static async parse(file, opts = {}) {
    if (!file) throw new Error('No file provided to BOQParser.')

    const arrayBuffer = await file.arrayBuffer()
    const data = new Uint8Array(arrayBuffer)
    const wb = XLSX.read(data, { type: 'array', cellDates: false })

    // Sheet selection
    let sheetName = opts.sheetName
    if (!sheetName) {
      // Prefer first sheet that isn't named 'Data', 'Summary', 'Blank'
      const skip = new Set(['Data', 'Summary', 'Blank'])
      sheetName = wb.SheetNames.find(n => !skip.has(n)) ?? wb.SheetNames[0]
    }
    if (opts.sheetIndex !== undefined) {
      sheetName = wb.SheetNames[opts.sheetIndex] ?? sheetName
    }

    const ws = wb.Sheets[sheetName]
    if (!ws) throw new Error(`Sheet "${sheetName}" not found.`)

    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
    const headerResult = detectHeader(rows)

    if (!headerResult) {
      return {
        items: [],
        sheetName,
        sheetNames: wb.SheetNames,
        headerRowIndex: -1,
        mapping: {},
        warnings: [
          'Could not detect a valid header row. Ensure the file has columns for Description and Rate (AED).',
        ],
      }
    }

    const { rowIndex: headerRowIndex, mapping } = headerResult
    const warnings = []
    const items = []

    for (let i = headerRowIndex + 1; i < rows.length; i++) {
      const row = rows[i]
      if (shouldSkipRow(row, mapping)) continue

      const rate = toNum(row[mapping.rate])
      const desc = toStr(row[mapping.description])

      // Skip rows with no description at all
      if (!desc) continue

      // Warn about rows with a description but no parseable rate
      if (rate === null && desc) {
        warnings.push(`Row ${i + 1}: "${desc.slice(0, 40)}" has no parseable rate — skipped.`)
        continue
      }

      const item = {
        rowIndex:    i,
        itemId:      mapping.itemId      !== undefined ? toStr(row[mapping.itemId])      : `BOQ_${i + 1}`,
        description: desc,
        category:    mapping.category    !== undefined ? toStr(row[mapping.category])    : '',
        rate,
        unit:        mapping.unit        !== undefined ? toStr(row[mapping.unit])        : 'Nr',
        quantity:    mapping.quantity    !== undefined ? (toNum(row[mapping.quantity]) ?? 1) : 1,
        location:    mapping.location    !== undefined ? toStr(row[mapping.location])    : '',
        model:       mapping.model       !== undefined ? toStr(row[mapping.model])       : '',
        finish:      mapping.finish      !== undefined ? toStr(row[mapping.finish])      : '',
      }

      // Total line value for financial calcs
      item.totalValue = item.rate * item.quantity

      items.push(item)
    }

    return {
      items,
      sheetName,
      sheetNames: wb.SheetNames,
      headerRowIndex,
      mapping,
      warnings,
    }
  }

  /**
   * List all sheets in a file without full parsing (cheap operation).
   * @param {File} file
   * @returns {Promise<string[]>}
   */
  static async getSheetNames(file) {
    const ab = await file.arrayBuffer()
    const wb = XLSX.read(new Uint8Array(ab), { type: 'array', bookSheets: true })
    return wb.SheetNames
  }
}
