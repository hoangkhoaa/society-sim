/**
 * Default `GameSettings` snapshot and helpers for validating persisted values.
 * Storage key: `GAME_SETTINGS_STORAGE_KEY` in `./storage-keys`.
 */

import type { GameSettings, MapBackgroundMode } from '../types'

/** Baseline toggles when no saved settings exist (or parse fails). */
export const GAME_SETTINGS_DEFAULTS: GameSettings = {
  enable_human_elections:        false,
  election_cycle_days:           90,
  enable_government_ai:          false,
  enable_npc_thoughts:           false,
  enable_press_ai:               false,
  enable_science_ai:             false,
  enable_consequence_prediction: false,
  map_background_mode:           'background_only',
}

/** Allowed `map_background_mode` values after migration from legacy names. */
export const MAP_BACKGROUND_MODE_WHITELIST = new Set<MapBackgroundMode>([
  'background_only',
  'background_blurred_layout',
  'layout_only',
])
