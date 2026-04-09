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

import type { Constitution, GameSettings } from '../types'

// ── Types ──────────────────────────────────────────────────────────────────────

/** Which occupation name pool variant to use for each role. */
export type OccVariant = 'feudal' | 'theocracy' | 'technocracy' | 'warlord' | 'collective' | 'capitalist' | 'default'

/** How initial capital is distributed across the population. */
export type CapitalMode =
  | 'pareto'      // gini-based Pareto spread (default for mixed economies)
  | 'feudal'      // lords own ~80%; serfs own 0
  | 'collective'  // small equal share for everyone (commune/socialist)
  | 'state'       // all capital = 0; state owns means of production (marxist)

/**
 * Simulation-level restrictions imposed by the regime.
 * Applied in network building, rumor propagation, and trade/capital systems.
 * These represent structural features of the political economy — not player toggles.
 */
export interface SimRestrictions {
  /** Multiplier on rumor propagation speed (1.0 = free press; 0.1 = near-total blackout) */
  info_spread_mult:  number   // 0.1–1.0
  /** Fraction of normal max info-ties built at init (censored regimes shrink information networks) */
  info_ties_cap:     number   // 0.3–1.0
  /** Probability a newly generated rumor is suppressed before reaching the population */
  censorship_prob:   number   // 0.0–0.90
  /** Allow cross-zone weak & info ties (false = checkpoints/curfew — only same-zone connections) */
  cross_zone_ties:   boolean
  /** Multiplier on P2P and formal market trade volume (stacks with market_freedom) */
  trade_mult:        number   // 0.2–1.0
  /** Allow private capital rental market (false = state controls all productive assets) */
  rent_market:       boolean
  /** Allow merchant peer-to-peer lending (false = usury banned or state credit only) */
  private_lending:   boolean
}

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

  /** Structural simulation restrictions derived from the regime's political economy. */
  simRestrictions: SimRestrictions
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

    // ── Feudal ──────────────────────────────────────────────────────────────
    // Serfs can't freely assemble, trade is lord-mediated, rumors are dangerous.
    case 'feudal': return {
      variant, capitalMode,
      featureDefaults: { enable_human_elections: false },
      lockedFeatures:  ['enable_human_elections'],
      npcTweaks: { fear_bonus: 18, isolation_bonus: 8, class_solidarity_bonus: 10, grievance_bonus: 15 },
      simRestrictions: {
        info_spread_mult: 0.35,   // word travels slow in a serf society
        info_ties_cap:    0.50,   // serfs have narrow information networks
        censorship_prob:  0.50,   // lords suppress dangerous talk
        cross_zone_ties:  false,  // manors are isolated; travel requires permission
        trade_mult:       0.50,   // lord-controlled markets; much trade is in-kind
        rent_market:      true,   // feudal rent is the whole point
        private_lending:  false,  // usury forbidden / controlled by lords
      },
    }

    // ── Theocracy ────────────────────────────────────────────────────────────
    // Information flows through religious institutions; trade is morally regulated.
    case 'theocracy': return {
      variant, capitalMode,
      featureDefaults: { enable_human_elections: false },
      lockedFeatures:  ['enable_human_elections'],
      npcTweaks: { fear_bonus: 8, isolation_bonus: -5, class_solidarity_bonus: 0, grievance_bonus: 0 },
      simRestrictions: {
        info_spread_mult: 0.55,   // clergy mediate information (slower but cohesive)
        info_ties_cap:    0.65,   // connections channeled through religious networks
        censorship_prob:  0.40,   // heresy suppressed; approved doctrine promoted
        cross_zone_ties:  true,   // pilgrimage and parish networks cross zones
        trade_mult:       0.65,   // usury restricted; religious tithe overhead
        rent_market:      true,   // religious estates can rent land
        private_lending:  false,  // interest-bearing loans doctrinally forbidden
      },
    }

    // ── Technocracy ──────────────────────────────────────────────────────────
    // Open information economy; meritocratic; high market activity.
    case 'technocracy': return {
      variant, capitalMode,
      featureDefaults: { enable_human_elections: true },
      lockedFeatures:  [],
      npcTweaks: { fear_bonus: -5, isolation_bonus: 5, class_solidarity_bonus: -5, grievance_bonus: -5 },
      simRestrictions: {
        info_spread_mult: 1.00,   // free press and fast information networks
        info_ties_cap:    1.00,   // unrestricted digital connections
        censorship_prob:  0.05,   // minimal censorship (security exceptions only)
        cross_zone_ties:  true,   // open borders between districts
        trade_mult:       0.85,   // well-regulated market; some compliance overhead
        rent_market:      true,
        private_lending:  true,
      },
    }

    // ── Warlord ──────────────────────────────────────────────────────────────
    // Information blackout, movement controlled, economy militarized / war-footing.
    case 'warlord': return {
      variant, capitalMode,
      featureDefaults: { enable_human_elections: false, enable_press_ai: false },
      lockedFeatures:  ['enable_human_elections'],
      npcTweaks: { fear_bonus: 28, isolation_bonus: 12, class_solidarity_bonus: 15, grievance_bonus: 20 },
      simRestrictions: {
        info_spread_mult: 0.15,   // information near-blackout; only propaganda
        info_ties_cap:    0.35,   // population atomized; distrust prevents connections
        censorship_prob:  0.80,   // almost all independent information suppressed
        cross_zone_ties:  false,  // checkpoints and curfews; zone-locked movement
        trade_mult:       0.25,   // war economy; most goods requisitioned by military
        rent_market:      true,   // warlords extract rent by force
        private_lending:  false,  // capital hoarded; no credit market
      },
    }

    // ── Collective ───────────────────────────────────────────────────────────
    // State media, party-approved connections, centrally directed economy.
    case 'collective': return {
      variant, capitalMode,
      featureDefaults: { enable_human_elections: true },
      lockedFeatures:  [],
      npcTweaks: { fear_bonus: -5, isolation_bonus: -10, class_solidarity_bonus: 20, grievance_bonus: -5 },
      simRestrictions: {
        info_spread_mult: 0.45,   // state media controls narrative; independent voices slow
        info_ties_cap:    0.60,   // connections go through party/collective structures
        censorship_prob:  0.55,   // counter-revolutionary speech suppressed
        cross_zone_ties:  true,   // collective solidarity crosses zone boundaries
        trade_mult:       0.40,   // state allocation replaces most market trade
        rent_market:      false,  // no private rental — state owns means of production
        private_lending:  false,  // state credit only; private capital accumulation banned
      },
    }

    // ── Capitalist ───────────────────────────────────────────────────────────
    // Free press, open networks, high market activity.
    case 'capitalist': return {
      variant, capitalMode,
      featureDefaults: { enable_human_elections: true },
      lockedFeatures:  [],
      npcTweaks: { fear_bonus: 0, isolation_bonus: 8, class_solidarity_bonus: -8, grievance_bonus: 5 },
      simRestrictions: {
        info_spread_mult: 0.90,   // free press; fast spread (slight friction from noise)
        info_ties_cap:    1.00,   // unrestricted social and commercial connections
        censorship_prob:  0.05,   // near-zero censorship
        cross_zone_ties:  true,   // open movement; trade networks cross zones
        trade_mult:       1.00,   // fully free market
        rent_market:      true,
        private_lending:  true,
      },
    }

    // ── Default (mixed / transitional) ───────────────────────────────────────
    default: return {
      variant: 'default', capitalMode,
      featureDefaults: {},
      lockedFeatures:  [],
      npcTweaks: { fear_bonus: 0, isolation_bonus: 0, class_solidarity_bonus: 0, grievance_bonus: 0 },
      simRestrictions: {
        info_spread_mult: 0.75,
        info_ties_cap:    0.85,
        censorship_prob:  0.10,
        cross_zone_ties:  true,
        trade_mult:       0.75,
        rent_market:      true,
        private_lending:  true,
      },
    }
  }
}
