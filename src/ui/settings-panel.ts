// ── Settings Panel ─────────────────────────────────────────────────────────────
// Self-contained module: manages GameSettings state, renders the panel, and
// provides getSettings() for other modules to read current preferences.

import { getLang, t, type Lang } from '../i18n'
import type { RegimeProfile, SimRestrictions } from '../sim/regime-config'
import {
  settingsTabRegime,
  settingsRegimeNoWorld,
  settingsRegimeNote,
  settingsRegimeSectionInfo,
  settingsRegimeSectionConnections,
  settingsRegimeSectionEconomy,
  settingsRegimeLabels,
  settingsRegimeCrossZoneAllowed,
  settingsRegimeCrossZoneLocked,
  settingsRegimeMarketAllowed,
  settingsRegimeMarketBanned,
  settingsToggleCopy,
} from '../local/ui'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface GameSettings {
  // AI-Driven features
  enable_human_elections:        boolean   // Step 6: NPCs elect a real leader NPC
  election_cycle_days:           number    // how often elections happen (sim-days)
  enable_government_ai:          boolean   // LLM drives policy generation
  enable_npc_thoughts:           boolean   // LLM generates spotlight daily thoughts
  enable_press_ai:               boolean   // LLM generates press headlines
  enable_consequence_prediction: boolean   // LLM predicts event ripple effects
}

const SETTINGS_KEY = 'game_settings_v1'

const DEFAULTS: GameSettings = {
  enable_human_elections:        false,
  election_cycle_days:           90,
  enable_government_ai:          true,
  enable_npc_thoughts:           true,
  enable_press_ai:               true,
  enable_consequence_prediction: true,
}

// ── State ──────────────────────────────────────────────────────────────────────

let _settings: GameSettings = { ...DEFAULTS }
let _lockedFeatures: Set<keyof GameSettings> = new Set()
let _regimeVariant: string = 'default'
let _simRestrictions: SimRestrictions | null = null

function loadSettings(): void {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) _settings = { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    _settings = { ...DEFAULTS }
  }
}

/**
 * Called at the start of each new game. Resets settings to regime-appropriate
 * defaults and locks features that the regime structurally disables.
 */
export function applyRegimeDefaults(profile: RegimeProfile): void {
  _lockedFeatures    = new Set(profile.lockedFeatures)
  _regimeVariant     = profile.variant
  _simRestrictions   = profile.simRestrictions

  // Apply feature defaults (locked features are always forced to their locked value)
  const s = _settings as unknown as Record<string, unknown>
  for (const [key, val] of Object.entries(profile.featureDefaults)) {
    s[key] = val
  }
  // Ensure locked features stay at their forced value
  for (const key of profile.lockedFeatures) {
    const forced = profile.featureDefaults[key]
    if (forced !== undefined) (_settings as unknown as Record<string, unknown>)[key] = forced
  }
  saveSettings()
  renderPanel()
}

function saveSettings(): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(_settings))
}

export function getSettings(): Readonly<GameSettings> { return _settings }

// ── Panel DOM ──────────────────────────────────────────────────────────────────

const panel     = document.getElementById('settings-panel')!
const panelBody = document.getElementById('settings-body')!
const btnClose  = document.getElementById('settings-close')!

export function openSettingsPanel(): void  { panel.classList.remove('hidden') }
export function closeSettingsPanel(): void { panel.classList.add('hidden') }

btnClose.addEventListener('click', closeSettingsPanel)

// Close on overlay click (click outside panel)
document.addEventListener('click', (e) => {
  if (!panel.classList.contains('hidden')
      && !panel.contains(e.target as Node)
      && (e.target as HTMLElement).id !== 'btn-settings') {
    closeSettingsPanel()
  }
})

// ── Tab state ──────────────────────────────────────────────────────────────────

let _activeTab: 'ai_driven' | 'regime' = 'ai_driven'

// ── Render helpers ─────────────────────────────────────────────────────────────

function pct(v: number): string { return `${Math.round(v * 100)}%` }

function renderRestrictionRow(icon: string, label: string, value: string, severity: 'low' | 'med' | 'high' | 'ok'): string {
  const color = severity === 'high' ? '#c44' : severity === 'med' ? '#b80' : severity === 'ok' ? '#4a4' : '#888'
  return `
    <div class="stg-row" style="padding:4px 0">
      <div class="stg-row-info">
        <div class="stg-row-label" style="font-size:11px">${icon} ${label}</div>
      </div>
      <div style="font-size:11px;font-weight:600;color:${color};min-width:60px;text-align:right">${value}</div>
    </div>`
}

function renderRegimeTab(lang: Lang): string {
  if (!_simRestrictions) {
    return `<div style="color:#888;font-size:11px;padding:8px 0">${settingsRegimeNoWorld(lang)}</div>`
  }
  const r = _simRestrictions
  const infoSev  = r.info_spread_mult < 0.30 ? 'high' : r.info_spread_mult < 0.60 ? 'med' : 'ok'
  const tiesSev  = r.info_ties_cap    < 0.45 ? 'high' : r.info_ties_cap    < 0.70 ? 'med' : 'ok'
  const censSev  = r.censorship_prob  > 0.60 ? 'high' : r.censorship_prob  > 0.30 ? 'med' : 'ok'
  const travelSev = r.cross_zone_ties ? 'ok' : 'high'
  const tradeSev = r.trade_mult       < 0.35 ? 'high' : r.trade_mult       < 0.65 ? 'med' : 'ok'
  const rentSev  = r.rent_market      ? 'ok' : 'med'
  const lendSev  = r.private_lending  ? 'ok' : 'med'

  const label = settingsRegimeLabels(lang)

  return `
    <div style="font-size:10px;color:#888;margin-bottom:6px">${settingsRegimeNote(lang)}</div>
    <div class="stg-section-label" style="font-size:10px;color:#777;margin:4px 0 2px">${settingsRegimeSectionInfo(lang)}</div>
    ${renderRestrictionRow('📢', label.info,   pct(r.info_spread_mult), infoSev)}
    ${renderRestrictionRow('🔗', label.ties,   pct(r.info_ties_cap),   tiesSev)}
    ${renderRestrictionRow('🔇', label.cens,   pct(r.censorship_prob), censSev)}
    <div class="stg-section-label" style="font-size:10px;color:#777;margin:6px 0 2px">${settingsRegimeSectionConnections(lang)}</div>
    ${renderRestrictionRow('🗺', label.travel, r.cross_zone_ties ? settingsRegimeCrossZoneAllowed(lang) : settingsRegimeCrossZoneLocked(lang), travelSev)}
    <div class="stg-section-label" style="font-size:10px;color:#777;margin:6px 0 2px">${settingsRegimeSectionEconomy(lang)}</div>
    ${renderRestrictionRow('🏪', label.trade,  pct(r.trade_mult),      tradeSev)}
    ${renderRestrictionRow('🏠', label.rent,   r.rent_market     ? settingsRegimeMarketAllowed(lang) : settingsRegimeMarketBanned(lang), rentSev)}
    ${renderRestrictionRow('🏦', label.lend,   r.private_lending ? settingsRegimeMarketAllowed(lang) : settingsRegimeMarketBanned(lang), lendSev)}`
}

// ── Render ─────────────────────────────────────────────────────────────────────

function renderPanel(): void {
  const lang = getLang()
  const c    = settingsToggleCopy(lang)

  const regimeLabel = _regimeVariant !== 'default'
    ? `<div class="stg-regime-badge">${_regimeVariant}</div>`
    : ''

  panelBody.innerHTML = `
    ${regimeLabel}
    <div class="stg-tabs">
      <button class="stg-tab ${_activeTab === 'ai_driven' ? 'active' : ''}" data-tab="ai_driven">
        🤖 AI-Driven
      </button>
      <button class="stg-tab ${_activeTab === 'regime' ? 'active' : ''}" data-tab="regime">
        ${settingsTabRegime(lang)}
      </button>
    </div>

    <div class="stg-tab-content" id="stg-content-ai_driven"
         style="display:${_activeTab === 'ai_driven' ? 'block' : 'none'}">

      ${renderToggleRow(
        'enable_human_elections',
        c.electionsLabel,
        c.electionsDesc,
        _settings.enable_human_elections,
        _lockedFeatures.has('enable_human_elections'),
      )}

      ${_settings.enable_human_elections ? renderNumberRow(
        'election_cycle_days',
        c.electionCycleLabel,
        _settings.election_cycle_days,
        30, 360,
      ) : ''}

      <div class="stg-divider"></div>

      ${renderToggleRow(
        'enable_government_ai',
        c.govAILabel,
        c.govAIDesc,
        _settings.enable_government_ai,
        _lockedFeatures.has('enable_government_ai'),
      )}

      ${renderToggleRow(
        'enable_npc_thoughts',
        c.npcThoughtsLabel,
        c.npcThoughtsDesc,
        _settings.enable_npc_thoughts,
        _lockedFeatures.has('enable_npc_thoughts'),
      )}

      ${renderToggleRow(
        'enable_press_ai',
        c.pressAILabel,
        c.pressAIDesc,
        _settings.enable_press_ai,
        _lockedFeatures.has('enable_press_ai'),
      )}

      ${renderToggleRow(
        'enable_consequence_prediction',
        c.consequencesLabel,
        c.consequencesDesc,
        _settings.enable_consequence_prediction,
        _lockedFeatures.has('enable_consequence_prediction'),
      )}

    </div>

    <div class="stg-tab-content" id="stg-content-regime"
         style="display:${_activeTab === 'regime' ? 'block' : 'none'}">
      ${renderRegimeTab(lang)}
    </div>
  `

  // Attach listeners (skip locked toggles)
  const s = _settings as unknown as Record<string, unknown>
  panelBody.querySelectorAll<HTMLElement>('[data-toggle]').forEach(el => {
    if (el.dataset.locked === '1') return   // regime-locked: not interactive
    el.addEventListener('click', () => {
      const key = el.dataset.toggle!
      s[key] = !s[key]
      saveSettings()
      renderPanel()
    })
  })

  panelBody.querySelectorAll<HTMLElement>('[data-tab]').forEach(el => {
    el.addEventListener('click', () => {
      _activeTab = el.dataset.tab as typeof _activeTab
      renderPanel()
    })
  })

  panelBody.querySelectorAll<HTMLInputElement>('input[data-num]').forEach(input => {
    input.addEventListener('change', () => {
      const key = input.dataset.num!
      s[key] = clampNum(parseInt(input.value, 10), parseInt(input.min, 10), parseInt(input.max, 10))
      input.value = String(s[key])
      saveSettings()
    })
  })
}

function clampNum(v: number, lo: number, hi: number): number {
  return isNaN(v) ? lo : Math.max(lo, Math.min(hi, v))
}

function renderToggleRow(key: string, label: string, desc: string, value: boolean, locked = false): string {
  const lockIcon  = locked ? ' 🔒' : ''
  const lockLabel = locked ? t('settings.regime_locked') as string : ''
  const stateLabel = value ? t('settings.enabled') as string : t('settings.disabled') as string
  return `
    <div class="stg-row${locked ? ' stg-row-locked' : ''}">
      <div class="stg-row-info">
        <div class="stg-row-label">${label}${lockIcon}</div>
        <div class="stg-row-desc">${desc}${locked ? `<br><em style="color:#553;font-style:normal">${lockLabel}</em>` : ''}</div>
      </div>
      <div class="stg-toggle ${value ? 'on' : 'off'}${locked ? ' stg-toggle-locked' : ''}"
           data-toggle="${key}" data-locked="${locked ? '1' : '0'}"
           title="${stateLabel}${locked ? ` (${lockLabel})` : ''}">
        <div class="stg-toggle-knob"></div>
      </div>
    </div>`
}

function renderNumberRow(key: string, label: string, value: number, min: number, max: number): string {
  return `
    <div class="stg-row stg-row-num">
      <div class="stg-row-info">
        <div class="stg-row-label" style="font-size:11px;color:#777">${label}</div>
      </div>
      <input class="stg-num-input" type="number" min="${min}" max="${max}" value="${value}"
             data-num="${key}" />
    </div>`
}

// ── Init ───────────────────────────────────────────────────────────────────────

loadSettings()
renderPanel()
