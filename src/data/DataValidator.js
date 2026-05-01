/**
 * DataValidator
 * Validates ParsedData structure and content.
 * Returns a ValidationReport so callers can surface problems to users.
 */

// ─── Required column presence (checked against parsed objects) ───────────────

const REQUIRED_FIELDS = {
  locationLayer: ['itemId', 'category', 'project', 'normLocation', 'rate'],
  locationDict:  ['normLocation', 'family'],
  benchmarks:    ['benchmarkId', 'category', 'normLocation', 'avgRate', 'minRate', 'maxRate'],
  sideBySide:    ['itemType', 'project', 'rate'],
}

const MIN_ROW_COUNTS = {
  locationLayer: 1,
  locationDict:  1,
  benchmarks:    1,
  sideBySide:    0, // optional
}

// Pricing flags considered anomalous — captured in the report but not blocking
const ANOMALOUS_FLAGS = new Set([
  'Overpriced',
  'Highly Overpriced',
  'Potentially Overpriced',
  'Potentially Underpriced',
])

// ─── Helpers ──────────────────────────────────────────────────────────────────

function err(code, message, details = null) {
  return { code, message, ...(details ? { details } : {}) }
}

function warn(code, message, details = null) {
  return { code, message, severity: 'warning', ...(details ? { details } : {}) }
}

function checkRequiredFields(sheet, rows) {
  const issues = []
  const fields = REQUIRED_FIELDS[sheet] ?? []

  for (const field of fields) {
    const missing = rows.reduce((acc, row, i) => {
      if (row[field] === undefined || row[field] === null || row[field] === '') {
        acc.push(i + 1) // 1-based row number
      }
      return acc
    }, [])

    if (missing.length) {
      issues.push(
        err(
          `MISSING_FIELD_${field.toUpperCase()}`,
          `Sheet "${sheet}": field "${field}" is missing in ${missing.length} row(s).`,
          { rowNumbers: missing.slice(0, 10) } // cap detail to first 10
        )
      )
    }
  }

  return issues
}

function checkNumericField(sheet, rows, field, label) {
  const bad = rows.reduce((acc, row, i) => {
    const v = row[field]
    if (v !== null && v !== undefined && isNaN(Number(v))) acc.push(i + 1)
    return acc
  }, [])
  if (bad.length) {
    return [err(`NON_NUMERIC_${field.toUpperCase()}`,
      `Sheet "${sheet}": "${label}" contains non-numeric values in ${bad.length} row(s).`,
      { rowNumbers: bad.slice(0, 10) })]
  }
  return []
}

function checkRateRange(sheet, rows, field, min = 0, max = 1_000_000) {
  const out = rows.reduce((acc, row, i) => {
    const v = row[field]
    if (v !== null && (v < min || v > max)) acc.push({ row: i + 1, value: v })
    return acc
  }, [])
  if (out.length) {
    return [warn(`RATE_OUT_OF_RANGE`,
      `Sheet "${sheet}": ${out.length} row(s) have rates outside [${min}, ${max}] AED.`,
      { samples: out.slice(0, 5) })]
  }
  return []
}

// ─── Public class ─────────────────────────────────────────────────────────────

export class DataValidator {
  /**
   * Validate a full ParsedData object.
   * @param {{ locationLayer, locationDict, benchmarks, sideBySide }} data
   * @returns {ValidationReport}
   */
  static validate(data) {
    const errors   = []
    const warnings = []
    const stats    = {}

    if (!data || typeof data !== 'object') {
      return {
        valid:  false,
        errors: [err('NULL_DATA', 'No data provided to validator.')],
        warnings: [],
        stats:  {},
      }
    }

    const { locationLayer = [], locationDict = [], benchmarks = [], sideBySide = [] } = data

    // ── Row count checks ─────────────────────────────────────────────────────
    for (const [sheet, minCount] of Object.entries(MIN_ROW_COUNTS)) {
      const rows = data[sheet] ?? []
      stats[sheet] = { rowCount: rows.length }

      if (rows.length < minCount) {
        errors.push(err(
          `EMPTY_SHEET_${sheet.toUpperCase()}`,
          `Sheet "${sheet}" has ${rows.length} row(s); expected at least ${minCount}.`
        ))
      }
    }

    // ── locationLayer (sheet 10) ─────────────────────────────────────────────
    // itemId and rate are hard requirements; category/project/location are soft
    const layerStrictIssues = checkRequiredFields('locationLayer',
      locationLayer.map(r => ({ itemId: r.itemId, rate: r.rate }))
    )
    errors.push(...layerStrictIssues)

    // Soft fields — missing in a few rows is common in real Excel files, warn only
    for (const field of ['category', 'project', 'normLocation']) {
      const missing = locationLayer.reduce((acc, row, i) => {
        if (row[field] === undefined || row[field] === null || row[field] === '') acc.push(i + 1)
        return acc
      }, [])
      if (missing.length) {
        warnings.push(warn(
          `MISSING_FIELD_${field.toUpperCase()}`,
          `Sheet "locationLayer": field "${field}" is missing in ${missing.length} row(s).`,
          { rowNumbers: missing.slice(0, 10) }
        ))
      }
    }

    errors.push(...checkNumericField('locationLayer', locationLayer, 'rate', 'Rate (AED)'))
    warnings.push(...checkRateRange('locationLayer', locationLayer, 'rate', 1, 500_000))

    // Anomalous pricing flags
    const anomalous = locationLayer.filter(r => ANOMALOUS_FLAGS.has(r.priceFlag))
    if (anomalous.length) {
      warnings.push(warn(
        'ANOMALOUS_PRICE_FLAGS',
        `${anomalous.length} item(s) carry anomalous pricing flags (Overpriced, Potentially Overpriced, etc.).`,
        { sample: anomalous.slice(0, 5).map(r => ({ itemId: r.itemId, flag: r.priceFlag })) }
      ))
    }

    // Duplicate item IDs
    const idCount = new Map()
    for (const r of locationLayer) idCount.set(r.itemId, (idCount.get(r.itemId) ?? 0) + 1)
    const dupes = [...idCount.entries()].filter(([, c]) => c > 1).map(([id]) => id)
    if (dupes.length) {
      warnings.push(warn(
        'DUPLICATE_ITEM_IDS',
        `${dupes.length} item ID(s) appear more than once in the location layer.`,
        { ids: dupes.slice(0, 10) }
      ))
    }

    // ── locationDict (sheet 11) ──────────────────────────────────────────────
    errors.push(...checkRequiredFields('locationDict', locationDict))

    // Families should match known set
    const KNOWN_FAMILIES = new Set([
      'RESIDENTIAL_PRIVATE', 'PUBLIC_COMMON', 'RELIGIOUS_CULTURAL',
      'HOSPITALITY_AMENITY', 'UNCLASSIFIED',
    ])
    const unknownFamilies = locationDict
      .filter(r => r.family && !KNOWN_FAMILIES.has(r.family))
      .map(r => r.family)
    if (unknownFamilies.length) {
      warnings.push(warn(
        'UNKNOWN_LOCATION_FAMILY',
        `${unknownFamilies.length} location entry/entries use an unrecognised family.`,
        { families: [...new Set(unknownFamilies)] }
      ))
    }

    // ── benchmarks (sheet 12) ────────────────────────────────────────────────
    errors.push(...checkRequiredFields('benchmarks', benchmarks))
    errors.push(...checkNumericField('benchmarks', benchmarks, 'avgRate',  'Average Rate'))
    errors.push(...checkNumericField('benchmarks', benchmarks, 'minRate',  'Minimum Rate'))
    errors.push(...checkNumericField('benchmarks', benchmarks, 'maxRate',  'Maximum Rate'))
    errors.push(...checkNumericField('benchmarks', benchmarks, 'priceIndex', 'Price Index'))
    warnings.push(...checkRateRange('benchmarks', benchmarks, 'avgRate', 1, 500_000))

    // minRate should never exceed maxRate
    const inverted = benchmarks.filter(b => b.minRate !== null && b.maxRate !== null && b.minRate > b.maxRate)
    if (inverted.length) {
      errors.push(err(
        'INVERTED_RATE_RANGE',
        `${inverted.length} benchmark row(s) have minRate > maxRate.`,
        { ids: inverted.map(b => b.benchmarkId).slice(0, 10) }
      ))
    }

    // avgRate should be within [minRate, maxRate]
    const avgOutside = benchmarks.filter(
      b => b.avgRate !== null && b.minRate !== null && b.maxRate !== null &&
           (b.avgRate < b.minRate || b.avgRate > b.maxRate)
    )
    if (avgOutside.length) {
      warnings.push(warn(
        'AVG_OUTSIDE_RANGE',
        `${avgOutside.length} benchmark row(s) have avgRate outside their min/max band.`,
        { ids: avgOutside.map(b => b.benchmarkId).slice(0, 10) }
      ))
    }

    // Price index must be ≥ 1.0
    const badIndex = benchmarks.filter(b => b.priceIndex !== null && b.priceIndex < 1)
    if (badIndex.length) {
      warnings.push(warn(
        'PRICE_INDEX_BELOW_ONE',
        `${badIndex.length} benchmark row(s) have a price index below 1.0.`,
        { ids: badIndex.map(b => b.benchmarkId).slice(0, 10) }
      ))
    }

    // ── Cross-sheet consistency ───────────────────────────────────────────────
    // Every category in locationLayer should appear in benchmarks
    const layerCats     = new Set(locationLayer.map(r => r.category))
    const benchmarkCats = new Set(benchmarks.map(r => r.category))
    const orphanCats    = [...layerCats].filter(c => c && !benchmarkCats.has(c))
    if (orphanCats.length) {
      warnings.push(warn(
        'CATEGORY_NOT_IN_BENCHMARKS',
        `${orphanCats.length} item categor(ies) in the location layer have no matching benchmark row.`,
        { categories: orphanCats }
      ))
    }

    // ── sideBySide (sheet 13) ────────────────────────────────────────────────
    if (sideBySide.length > 0) {
      errors.push(...checkRequiredFields('sideBySide', sideBySide))
      errors.push(...checkNumericField('sideBySide', sideBySide, 'rate', 'Rate (AED)'))
    }

    // ── Final stats ──────────────────────────────────────────────────────────
    stats.categories = new Set(benchmarks.map(b => b.category)).size
    stats.locations  = new Set(benchmarks.map(b => b.normLocation)).size
    stats.projects   = new Set(locationLayer.map(r => r.project)).size

    return {
      valid:    errors.length === 0,
      errors,
      warnings,
      stats,
    }
  }

  /**
   * Quick check — only validates that required sheets are present and non-empty.
   * Lighter than full validation; useful after ExcelParser completes.
   * @param {{ locationLayer, locationDict, benchmarks, sideBySide }} data
   * @returns {{ ok: boolean, message: string }}
   */
  static quickCheck(data) {
    const report = DataValidator.validate(data)
    if (!report.valid) {
      return { ok: false, message: report.errors[0].message }
    }
    return { ok: true, message: `Data OK — ${report.stats.categories} categories, ${report.stats.locations} locations, ${report.stats.projects} projects.` }
  }
}
