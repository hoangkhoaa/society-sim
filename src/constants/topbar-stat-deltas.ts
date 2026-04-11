/**
 * Maps macro fields to top-bar DOM ids and i18n labels for daily delta badges + crisis banner.
 */

export interface TopbarStatDeltaDef {
  valueId: string
  statId: string
  key: 'stability' | 'food' | 'natural_resources' | 'energy' | 'trust'
  i18nKey: string
}

export const TOPBAR_STAT_DELTA_DEFINITIONS: TopbarStatDeltaDef[] = [
  { valueId: 'v-stability', statId: 'stat-stability', key: 'stability',        i18nKey: 'topbar.stat_stability' },
  { valueId: 'v-food',      statId: 'stat-food',      key: 'food',             i18nKey: 'topbar.stat_food' },
  { valueId: 'v-resources', statId: 'stat-resources', key: 'natural_resources', i18nKey: 'topbar.stat_resources' },
  { valueId: 'v-energy',    statId: 'stat-energy',    key: 'energy',           i18nKey: 'topbar.stat_energy' },
  { valueId: 'v-trust',     statId: 'stat-trust',     key: 'trust',            i18nKey: 'topbar.stat_trust' },
]

/** Minimum absolute day-over-day change (percentage points) to show a delta badge. */
export const TOPBAR_STAT_DELTA_BADGE_MIN = 3

/** Count of stats at ≤20% that triggers the multi-stat crisis banner. */
export const TOPBAR_CRISIS_STAT_COUNT = 3

/** Macro % at or below this marks a stat as “critical” for the crisis banner. */
export const TOPBAR_CRITICAL_THRESHOLD_PCT = 20
