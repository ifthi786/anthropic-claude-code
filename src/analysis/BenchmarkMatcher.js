/**
 * BenchmarkMatcher
 * Maps BOQ item descriptions and categories to benchmark category keys.
 *
 * Matching tiers (first match wins, score reported to caller):
 *   1. Exact normalised match against known category list             → 1.00
 *   2. Alias dictionary (hand-curated synonyms for each category)     → 0.95
 *   3. Token Jaccard overlap with category label words                → 0.45 – 0.85
 *   4. Partial substring containment                                  → 0.30 – 0.60
 *   5. No match                                                       → 0.00
 *
 * All decisions include a `reason` string for use by the chatbot.
 */

// ─── Alias dictionary ─────────────────────────────────────────────────────────
// Each entry: canonical_category → string[] of known synonyms / sub-phrases.
// Phrases are lower-cased; matching is case-insensitive containment.

const CATEGORY_ALIASES = {
  BASIN_MIXER: [
    'basin mixer', 'wash basin mixer', 'washbasin mixer', 'lavatory faucet',
    'lavatory mixer', 'sink mixer', 'hand basin mixer', 'basin tap',
    'basin faucet', 'single lever basin', 'basin valve',
    'wall mount lavatory', 'wall-mount lavatory',
  ],
  BATH_MIXER: [
    'bath mixer', 'bathtub faucet', 'bath tap', 'bath filler',
    'bath faucet', 'tub faucet', 'bath deck mixer', 'bath valve',
  ],
  BATH_SHOWER_MIXER: [
    'bath shower mixer', 'shower bath mixer', 'bath shower set',
    'bath/shower mixer', 'bath & shower', 'bath and shower mixer',
    'combined bath shower', 'shower bath faucet',
  ],
  BIDET_SPRAY: [
    'bidet spray', 'toilet spray', 'health faucet', 'shattaf',
    'bidet faucet', 'hygiene spray', 'hand bidet', 'bidet hose',
  ],
  BUILT_IN_BATHTUB: [
    'built-in bathtub', 'built in bathtub', 'built in bath',
    'inset bath', 'drop-in bathtub', 'drop in bathtub',
    'alcove bathtub', 'recessed bathtub', 'inset bathtub',
    'bathtub ledge', 'built-in tub',
  ],
  CONCEALED_CISTERN: [
    'concealed cistern', 'hidden cistern', 'flush cistern',
    'in-wall cistern', 'in wall cistern', 'wc cistern',
    'wall hung cistern', 'concealed flush', 'back to wall cistern',
  ],
  COUNTERTOP_BASIN: [
    'countertop basin', 'counter top basin', 'vessel basin',
    'vessel sink', 'above counter basin', 'deck mounted basin',
    'surface mount basin', 'top mount basin',
  ],
  FLOOR_STANDING_WC: [
    'floor standing wc', 'floor mounted toilet', 'floor standing toilet',
    'close coupled wc', 'close coupled toilet', 'floor wc',
    'floor mounted wc', 'p-trap wc', 's-trap wc',
  ],
  FLUSH_PLATE: [
    'flush plate', 'flush button', 'flush actuator', 'push plate',
    'flush panel', 'wc flush plate', 'dual flush plate', 'flush cover',
  ],
  FLUSH_VALVE: [
    'flush valve', 'flushometer', 'urinal flush valve', 'automatic flush',
    'sensor flush', 'flush mechanism',
  ],
  FREESTANDING_BASIN: [
    'freestanding basin', 'free standing basin', 'pedestal basin',
    'pedestal sink', 'column basin', 'column lavatory',
  ],
  FREESTANDING_BATHTUB: [
    'freestanding bathtub', 'free standing bathtub', 'free standing bath',
    'standalone bath', 'standalone bathtub', 'freestanding tub',
    'freestanding bath', 'roll top bath',
  ],
  HAND_SHOWER: [
    'hand shower', 'handshower', 'shower handset', 'shower wand',
    'handheld shower', 'portable shower', 'shower spray',
  ],
  SEMI_RECESSED_BASIN: [
    'semi recessed basin', 'semi-recessed basin', 'semi inset basin',
    'semi countertop basin', 'partial inset basin',
  ],
  SHOWER_HEAD: [
    'shower head', 'showerhead', 'fixed shower head', 'overhead shower',
    'rain shower', 'rain shower head', 'ceiling shower',
    'ceiling mounted shower', 'shower rose',
  ],
  SHOWER_MIXER: [
    'shower mixer', 'thermostatic shower mixer', 'shower control',
    'shower valve', 'thermostatic valve', 'concealed shower valve',
    'pressure balance valve', 'shower mixing valve',
  ],
  SHOWER_SET: [
    'shower set', 'shower system', 'complete shower set',
    'shower kit', 'shower pack', 'shower column', 'shower tower',
  ],
  SMART_WC: [
    'smart wc', 'smart toilet', 'electronic toilet', 'intelligent toilet',
    'bidet wc', 'washlet', 'integrated bidet', 'toilet washlet',
    'electronic bidet toilet',
  ],
  UNDERCOUNTER_BASIN: [
    'undercounter basin', 'under counter basin', 'undermount basin',
    'undermount sink', 'under mount basin', 'recessed basin',
  ],
  URINAL: [
    'urinal', 'wall urinal', 'bowl urinal', 'waterless urinal',
    'sensor urinal', 'urinals',
  ],
  WALL_HUNG_BASIN: [
    'wall hung basin', 'wall mounted basin', 'wall mount basin',
    'wall-hung basin', 'wall basin', 'wall-mounted lavatory',
    'wall lavatory',
  ],
  WALL_HUNG_WC: [
    'wall hung wc', 'wall mounted toilet', 'wall hung toilet',
    'wall-hung wc', 'wall hung toilet', 'wc pan', 'wall mounted wc',
    'back to wall wc',
  ],
  WALL_SPOUT: [
    'wall spout', 'wall mounted spout', 'spout', 'bath spout',
    'wall tub spout', 'bathtub spout', 'deck spout',
  ],
  WASH_BASIN_GENERIC: [
    'wash basin', 'washbasin', 'lavatory', 'vanity basin',
    'basin generic', 'generic basin',
  ],
  WC_GENERIC: [
    'wc', 'toilet', 'water closet', 'toilet pan', 'toilet bowl',
    'wc pan generic', 'generic wc',
  ],
  WC_SEAT: [
    'wc seat', 'toilet seat', 'toilet lid', 'seat cover',
    'slow close seat', 'soft close seat',
  ],
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Normalise a free-text string → lowercase, collapse whitespace, strip punctuation. */
function norm(str) {
  return str
    .toLowerCase()
    .replace(/[_\-\/\\]+/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Convert UPPER_SNAKE category key to space-separated words for token matching. */
function categoryWords(cat) {
  return cat.toLowerCase().split('_').filter(Boolean)
}

/** Jaccard similarity of two word arrays. */
function jaccard(a, b) {
  const setA = new Set(a)
  const setB = new Set(b)
  const inter = [...setA].filter(w => setB.has(w)).length
  const union = new Set([...setA, ...setB]).size
  return union === 0 ? 0 : inter / union
}

// Pre-build normalised alias map: normAlias → category
const NORM_ALIAS_MAP = new Map()
for (const [cat, aliases] of Object.entries(CATEGORY_ALIASES)) {
  for (const alias of aliases) {
    NORM_ALIAS_MAP.set(norm(alias), cat)
  }
}

// Pre-build token map: category → word tokens
const CATEGORY_TOKENS = new Map()
for (const cat of Object.keys(CATEGORY_ALIASES)) {
  CATEGORY_TOKENS.set(cat, categoryWords(cat))
}

// ─── Public class ─────────────────────────────────────────────────────────────

export class BenchmarkMatcher {
  /**
   * @param {string[]} knownCategories  All benchmark category keys from BenchmarkStore
   */
  constructor(knownCategories) {
    this._categories = new Set(knownCategories)
  }

  /**
   * Match a single BOQ item to a benchmark category.
   *
   * @param {{ description: string, category?: string }} boqItem
   * @returns {MatchResult}
   */
  match(boqItem) {
    const inputCategory    = boqItem.category    ?? ''
    const inputDescription = boqItem.description ?? ''

    // ── Tier 1: exact normalised match on the explicit category field ─────────
    if (inputCategory) {
      const upper = inputCategory.toUpperCase().replace(/\s+/g, '_')
      if (this._categories.has(upper)) {
        return {
          category:   upper,
          confidence: 1.0,
          tier:       'exact',
          reason:     `Exact match on provided category "${inputCategory}" → "${upper}".`,
        }
      }
    }

    // ── Tier 2: alias dictionary against category field then description ──────
    const candidates = [inputCategory, inputDescription]
    for (const text of candidates) {
      if (!text) continue
      const n = norm(text)

      // Full-string alias match
      if (NORM_ALIAS_MAP.has(n)) {
        const cat = NORM_ALIAS_MAP.get(n)
        if (this._categories.has(cat)) {
          return {
            category:   cat,
            confidence: 0.95,
            tier:       'alias',
            reason:     `Alias dictionary: "${text}" matched known synonym for "${cat}".`,
          }
        }
      }

      // Substring alias match
      for (const [alias, cat] of NORM_ALIAS_MAP) {
        if (n.includes(alias) || alias.includes(n)) {
          if (this._categories.has(cat)) {
            return {
              category:   cat,
              confidence: 0.85,
              tier:       'alias_partial',
              reason:     `Partial alias: "${text}" contains/matches synonym "${alias}" for "${cat}".`,
            }
          }
        }
      }
    }

    // ── Tier 3: token Jaccard against all category labels ─────────────────────
    const tokens = norm(inputDescription + ' ' + inputCategory).split(' ').filter(Boolean)
    let bestCat   = null
    let bestScore = 0

    for (const [cat, catTokens] of CATEGORY_TOKENS) {
      if (!this._categories.has(cat)) continue
      const score = jaccard(tokens, catTokens)
      if (score > bestScore) {
        bestScore = score
        bestCat   = cat
      }
    }

    if (bestScore >= 0.45) {
      return {
        category:   bestCat,
        confidence: Math.min(0.45 + bestScore * 0.4, 0.85),
        tier:       'token',
        reason:     `Token overlap (Jaccard ${(bestScore * 100).toFixed(0)}%) between "${inputDescription}" and category "${bestCat}".`,
      }
    }

    // ── Tier 4: single-word containment fallback ──────────────────────────────
    for (const [cat, catTokens] of CATEGORY_TOKENS) {
      if (!this._categories.has(cat)) continue
      const overlap = catTokens.filter(w => tokens.includes(w)).length
      if (overlap >= 1) {
        const score = overlap / Math.max(catTokens.length, tokens.length)
        if (score > bestScore) {
          bestScore = score
          bestCat   = cat
        }
      }
    }

    if (bestCat && bestScore > 0) {
      return {
        category:   bestCat,
        confidence: Math.max(0.25, Math.min(bestScore * 0.6, 0.44)),
        tier:       'partial',
        reason:     `Weak word overlap: "${inputDescription}" shares word(s) with category "${bestCat}" (low confidence).`,
      }
    }

    // ── No match ──────────────────────────────────────────────────────────────
    return {
      category:   null,
      confidence: 0,
      tier:       'none',
      reason:     `No benchmark category found for "${inputDescription || inputCategory}".`,
    }
  }

  /**
   * Batch-match an array of BOQ items.
   * @param {BOQItem[]} items
   * @returns {MatchResult[]}
   */
  matchAll(items) {
    return items.map(item => this.match(item))
  }

  /**
   * Return human-readable confidence label.
   * @param {number} confidence
   */
  static confidenceLabel(confidence) {
    if (confidence >= 0.95) return 'Exact'
    if (confidence >= 0.80) return 'High'
    if (confidence >= 0.55) return 'Medium'
    if (confidence >= 0.25) return 'Low'
    return 'None'
  }
}
