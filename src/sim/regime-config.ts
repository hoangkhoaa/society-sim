// ── Regime Configuration ──────────────────────────────────────────────────────
// Derives a RegimeProfile from constitution values (not preset name), so custom
// AI-described societies also get correct flavoring.
//
// RegimeProfile drives:
//   • Occupation name pool variant (e.g. "feudal" → Serfs, Lords)
//   • Capital distribution mode at init
//   • Initial NPC stat tweaks (extra fear, solidarity, etc.)
//   • Default GameSettings for this regime
//   • Which GameSettings are structurally locked by this regime

import type { Constitution } from '../types'
import type { GameSettings }  from '../ui/settings-panel'

// ── Types ──────────────────────────────────────────────────────────────────────

/** Which occupation name pool variant to use for each role. */
export type OccVariant = 'feudal' | 'theocracy' | 'technocracy' | 'warlord' | 'collective' | 'capitalist' | 'default'

/** How initial capital is distributed across the population. */
export type CapitalMode =
  | 'pareto'      // gini-based Pareto spread (default for mixed economies)
  | 'feudal'      // lords own ~80%; serfs own 0
  | 'collective'  // small equal share for everyone (commune/socialist)
  | 'state'       // all capital = 0; state owns means of production (marxist)

export interface RegimeProfile {
  variant: OccVariant
  capitalMode: CapitalMode

  /** Applied to GameSettings at the start of a new game (user can still override unless locked). */
  featureDefaults: Partial<GameSettings>

  /** Keys in GameSettings that are structurally locked by this regime. */
  lockedFeatures: (keyof GameSettings)[]

  /** Added to random initial NPC stats at creation time. */
  npcTweaks: {
    fear_bonus:              number   // extra fear (0–30 typical)
    isolation_bonus:         number   // extra isolation
    class_solidarity_bonus:  number   // extra starting class consciousness
    grievance_bonus:         number   // extra grievance
  }
}

// ── Variant detection ─────────────────────────────────────────────────────────
// Ordered by specificity: most distinctive conditions first.

export function getOccVariant(c: Constitution): OccVariant {
  // Warlord: militarised + scarce resources + near-zero rights
  if (c.state_power >= 0.78 && c.resource_scarcity >= 0.65 && c.individual_rights_floor < 0.10)
    return 'warlord'
  // Feudal: extreme wealth gap + very low rights
  if (c.gini_start >= 0.60 && c.individual_rights_floor < 0.20)
    return 'feudal'
  // Theocracy: high state power + high trust + high cohesion
  if (c.state_power >= 0.70 && c.base_trust >= 0.65 && c.network_cohesion >= 0.70)
    return 'theocracy'
  // Technocracy: growth-first + strong individual rights
  if (c.value_priority[0] === 'growth' && c.individual_rights_floor >= 0.50)
    return 'technocracy'
  // Collective (commune / socialist / marxist): very low market freedom
  if (c.market_freedom < 0.20)
    return 'collective'
  // Capitalist: high market freedom, low state
  if (c.market_freedom >= 0.75 && c.state_power < 0.45)
    return 'capitalist'
  return 'default'
}

// ── Capital mode ──────────────────────────────────────────────────────────────

function deriveCapitalMode(c: Constitution, variant: OccVariant): CapitalMode {
  // Pure planned economy (marxist-like): state owns means of production
  if (c.market_freedom < 0.10 && c.state_power >= 0.80) return 'state'
  // Commune or socialist collective
  if (c.market_freedom < 0.20) return 'collective'
  // Feudal / warlord: extreme concentration in ruling class
  if (variant === 'feudal' || variant === 'warlord') return 'feudal'
  return 'pareto'
}

// ── Profile table ─────────────────────────────────────────────────────────────

export function getRegimeProfile(c: Constitution): RegimeProfile {
  const variant     = getOccVariant(c)
  const capitalMode = deriveCapitalMode(c, variant)

  switch (variant) {

    case 'feudal': return {
      variant, capitalMode,
      featureDefaults: { enable_human_elections: false },
      lockedFeatures:  ['enable_human_elections'],
      npcTweaks: { fear_bonus: 18, isolation_bonus: 8, class_solidarity_bonus: 10, grievance_bonus: 15 },
    }

    case 'theocracy': return {
      variant, capitalMode,
      featureDefaults: { enable_human_elections: false },
      lockedFeatures:  ['enable_human_elections'],
      npcTweaks: { fear_bonus: 8, isolation_bonus: -5, class_solidarity_bonus: 0, grievance_bonus: 0 },
    }

    case 'technocracy': return {
      variant, capitalMode,
      featureDefaults: { enable_human_elections: true },
      lockedFeatures:  [],
      npcTweaks: { fear_bonus: -5, isolation_bonus: 5, class_solidarity_bonus: -5, grievance_bonus: -5 },
    }

    case 'warlord': return {
      variant, capitalMode,
      featureDefaults: { enable_human_elections: false, enable_press_ai: false },
      lockedFeatures:  ['enable_human_elections'],
      npcTweaks: { fear_bonus: 28, isolation_bonus: 12, class_solidarity_bonus: 15, grievance_bonus: 20 },
    }

    case 'collective': return {
      variant, capitalMode,
      featureDefaults: { enable_human_elections: true },
      lockedFeatures:  [],
      npcTweaks: { fear_bonus: -5, isolation_bonus: -10, class_solidarity_bonus: 20, grievance_bonus: -5 },
    }

    case 'capitalist': return {
      variant, capitalMode,
      featureDefaults: { enable_human_elections: true },
      lockedFeatures:  [],
      npcTweaks: { fear_bonus: 0, isolation_bonus: 8, class_solidarity_bonus: -8, grievance_bonus: 5 },
    }

    default: return {
      variant: 'default', capitalMode,
      featureDefaults: {},
      lockedFeatures:  [],
      npcTweaks: { fear_bonus: 0, isolation_bonus: 0, class_solidarity_bonus: 0, grievance_bonus: 0 },
    }
  }
}
