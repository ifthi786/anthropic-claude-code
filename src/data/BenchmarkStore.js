/**
 * BenchmarkStore
 * In-memory store built from ParsedData returned by ExcelParser.
 * Uses Maps for O(1) / O(k) lookups.
 *
 * Terminology:
 *   category     – Normalized Item Category  (e.g. "BASIN_MIXER")
 *   location     – Normalized Location       (e.g. "RESIDENTIAL_UNIT")
 *   project      – Project name              (e.g. "Sama Yas")
 */

export class BenchmarkStore {
  /** @param {import('./ExcelParser').ParsedData} data */
  constructor(data) {
    if (!data) throw new Error('BenchmarkStore requires parsed data.')
    this._raw = data

    // Index: benchmarks (sheet 12)
    this._byCategory    = new Map()  // category  → Benchmark[]
    this._byLocation    = new Map()  // location  → Benchmark[]
    this._byBenchmarkId = new Map()  // benchmarkId → Benchmark

    // Index: locationLayer items (sheet 10)
    this._byProject     = new Map()  // project   → Item[]
    this._byItemId      = new Map()  // itemId    → Item

    // Index: sideBySide (sheet 13)
    this._sbsByItemType = new Map()  // itemType  → ProjectComparison[]
    this._sbsByProject  = new Map()  // project   → ProjectComparison[]

    // Index: locationDict
    this._dictByNorm    = new Map()  // normLocation → LocationEntry[]

    this._buildIndexes()
  }

  // ─── Index builder ──────────────────────────────────────────────────────────

  _buildIndexes() {
    const { benchmarks, locationLayer, sideBySide, locationDict } = this._raw

    for (const b of benchmarks) {
      _pushTo(this._byCategory,    b.category,     b)
      _pushTo(this._byLocation,    b.normLocation, b)
      this._byBenchmarkId.set(b.benchmarkId, b)
    }

    for (const item of locationLayer) {
      _pushTo(this._byProject, item.project, item)
      this._byItemId.set(item.itemId, item)
    }

    for (const c of sideBySide) {
      _pushTo(this._sbsByItemType, c.itemType, c)
      _pushTo(this._sbsByProject,  c.project,  c)
    }

    for (const entry of locationDict) {
      _pushTo(this._dictByNorm, entry.normLocation, entry)
    }
  }

  // ─── Search methods ─────────────────────────────────────────────────────────

  /**
   * All benchmark rows for a given item category.
   * @param {string} category  e.g. "BASIN_MIXER"
   * @returns {Benchmark[]}
   */
  findByCategory(category) {
    return this._byCategory.get(normalise(category)) ?? []
  }

  /**
   * All benchmark rows for a given normalised location.
   * @param {string} location  e.g. "RESIDENTIAL_UNIT"
   * @returns {Benchmark[]}
   */
  findByLocation(location) {
    return this._byLocation.get(normalise(location)) ?? []
  }

  /**
   * Look up a benchmark by its ID (sheet-12 benchmark IDs like "LBM_001").
   * Falls back to searching the item-level layer (sheet 10) by itemId.
   * @param {string} itemId
   * @returns {Benchmark | Item | undefined}
   */
  findByItem(itemId) {
    return this._byBenchmarkId.get(itemId) ?? this._byItemId.get(itemId)
  }

  /**
   * All item-level rows (sheet 10) belonging to a project.
   * @param {string} projectName  e.g. "Sama Yas"
   * @returns {Item[]}
   */
  findByProject(projectName) {
    // Try exact match first, then case-insensitive
    return (
      this._byProject.get(projectName) ??
      this._byProject.get(normalise(projectName)) ??
      _ciSearch(this._byProject, projectName)
    )
  }

  /**
   * Side-by-side comparison entries for a specific item type.
   * @param {string} itemType  e.g. "BASIN_MIXER"
   * @returns {ProjectComparison[]}
   */
  findComparisonsByItemType(itemType) {
    return this._sbsByItemType.get(normalise(itemType)) ?? []
  }

  /**
   * All comparison entries contributed by a project.
   * @param {string} projectName
   * @returns {ProjectComparison[]}
   */
  findComparisonsByProject(projectName) {
    return (
      this._sbsByProject.get(projectName) ??
      _ciSearch(this._sbsByProject, projectName)
    )
  }

  /**
   * Location dictionary entries for a normalised location.
   * @param {string} normLocation
   * @returns {LocationEntry[]}
   */
  findLocationEntries(normLocation) {
    return this._dictByNorm.get(normalise(normLocation)) ?? []
  }

  // ─── Stats methods ──────────────────────────────────────────────────────────

  /**
   * Mean of avgRate values for all benchmark rows matching category + location.
   * Returns null when no matches exist.
   * @param {string} category
   * @param {string} location
   * @returns {number | null}
   */
  getAverageRate(category, location) {
    const matches = this._matchCatLoc(category, location)
    if (!matches.length) return null
    const rates = matches.map(b => b.avgRate).filter(r => r !== null)
    if (!rates.length) return null
    return rates.reduce((s, r) => s + r, 0) / rates.length
  }

  /**
   * Overall min/max across all matching benchmark rows.
   * @param {string} category
   * @param {string} location
   * @returns {{ min: number, max: number } | null}
   */
  getMinMaxRange(category, location) {
    const matches = this._matchCatLoc(category, location)
    const mins = matches.map(b => b.minRate).filter(r => r !== null)
    const maxs = matches.map(b => b.maxRate).filter(r => r !== null)
    if (!mins.length) return null
    return { min: Math.min(...mins), max: Math.max(...maxs) }
  }

  /**
   * Weighted-average Location Price Index for a given location across all categories.
   * The index is relative to a baseline of 1.00 (cheapest location).
   * @param {string} location
   * @returns {number | null}
   */
  getPriceIndex(location) {
    const rows = this.findByLocation(location)
    const indices = rows.map(b => b.priceIndex).filter(v => v !== null)
    if (!indices.length) return null
    return indices.reduce((s, v) => s + v, 0) / indices.length
  }

  /**
   * Summary of a category across all locations.
   * @param {string} category
   * @returns {CategorySummary}
   */
  getCategorySummary(category) {
    const rows = this.findByCategory(category)
    if (!rows.length) return null

    const allMins  = rows.map(b => b.minRate).filter(v => v !== null)
    const allMaxs  = rows.map(b => b.maxRate).filter(v => v !== null)
    const allAvgs  = rows.map(b => b.avgRate).filter(v => v !== null)
    const totalOcc = rows.reduce((s, b) => s + b.occurrences, 0)

    return {
      category,
      totalOccurrences: totalOcc,
      locationCount:    rows.length,
      overallMin:       allMins.length ? Math.min(...allMins) : null,
      overallMax:       allMaxs.length ? Math.max(...allMaxs) : null,
      overallAvg:       allAvgs.length ? allAvgs.reduce((s, v) => s + v, 0) / allAvgs.length : null,
      locations:        rows.map(b => b.normLocation),
      projects:         [...new Set(rows.flatMap(b => b.projects))],
    }
  }

  /**
   * All distinct category names in the benchmark data.
   * @returns {string[]}
   */
  getCategories() {
    return [...this._byCategory.keys()].sort()
  }

  /**
   * All distinct normalised locations in the benchmark data.
   * @returns {string[]}
   */
  getLocations() {
    return [...this._byLocation.keys()].sort()
  }

  /**
   * All distinct project names in the item layer.
   * @returns {string[]}
   */
  getProjects() {
    return [...this._byProject.keys()].sort()
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  _matchCatLoc(category, location) {
    const cat = normalise(category)
    const loc = normalise(location)
    const byCat = this._byCategory.get(cat) ?? []
    // If no location filter, return all for category
    if (!loc) return byCat
    return byCat.filter(b => b.normLocation === loc)
  }
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function _pushTo(map, key, value) {
  if (!key) return
  const list = map.get(key)
  if (list) list.push(value)
  else      map.set(key, [value])
}

/** Normalize a key to UPPER_SNAKE for partial matching. */
function normalise(str) {
  if (!str) return ''
  return str.trim().toUpperCase().replace(/\s+/g, '_')
}

/** Case-insensitive Map search — returns first match. */
function _ciSearch(map, query) {
  const q = query.toLowerCase()
  for (const [key, value] of map) {
    if (key.toLowerCase() === q) return value
  }
  return []
}
