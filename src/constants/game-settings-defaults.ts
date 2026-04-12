/**
 * Default `GameSettings` snapshot and helpers for validating persisted values.
 * Storage key: `GAME_SETTINGS_STORAGE_KEY` in `./storage-keys`.
 */

import type { GameSettings, MapBackgroundMode } from '../types'

/** Baseline toggles when no saved settings exist (or parse fails). */
export const GAME_SETTINGS_DEFAULTS: GameSettings = {
  enable_human_elections:        false,
  election_cycle_days:           90,
  enable_government_ai:          true,
  enable_npc_thoughts:           true,
  enable_press_ai:               true,
  enable_science_ai:             true,
  enable_consequence_prediction: true,
  map_background_mode:           'background_only',
}

/** Allowed `map_background_mode` values after migration from legacy names. */
export const MAP_BACKGROUND_MODE_WHITELIST = new Set<MapBackgroundMode>([
  'background_only',
  'background_blurred_layout',
  'layout_only',
])
