/**
 * Central registry for `localStorage` keys.
 * Keeps string literals in one place to avoid typos and silent mismatches.
 */

/** Light / dark theme for `document.body.dataset.theme`. */
export const THEME_STORAGE_KEY = 'sim_theme'

/** Demographics side panel visibility (`'1'` / `'0'`). */
export const UI_DEMOGRAPHICS_VISIBLE_KEY = 'ui_demographics_visible'

/** Rumors overlay visibility. */
export const UI_RUMORS_VISIBLE_KEY = 'ui_rumors_visible'

/** Map legend overlay (opt-in: stored `'1'` to show). */
export const UI_LEGEND_VISIBLE_KEY = 'ui_legend_visible'

/** Social network tie lines on the map. */
export const UI_NETWORK_VISIBLE_KEY = 'ui_network_visible'

/** Economics panel visibility. */
export const UI_ECON_VISIBLE_KEY = 'ui_econ_visible'

/** NPC contacts panel (spotlight / chat history). */
export const UI_NPC_CONTACTS_VISIBLE_KEY = 'ui_npc_contacts_visible'

/** Conflict / enmity overlay on the map canvas. */
export const UI_CONFLICT_OVERLAY_KEY = 'ui_conflict_overlay_visible'

/** Active tab in the unified dashboard panel (`demographics` | `rumors` | `econ` | `contacts`). */
export const UI_DASHBOARD_TAB_KEY = 'ui_dashboard_tab'

/** Visibility of the unified dashboard panel. */
export const UI_DASHBOARD_VISIBLE_KEY = 'ui_dashboard_visible'

/** Serialized `GameSettings` JSON (see `game-settings-defaults.ts`). */
export const GAME_SETTINGS_STORAGE_KEY = 'game_settings_v1'

/** Active UI language code (`en`, `vi`, …). */
export const LANG_STORAGE_KEY = 'society_sim_lang'
