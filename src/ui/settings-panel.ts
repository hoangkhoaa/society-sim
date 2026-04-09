// ── Settings Panel ─────────────────────────────────────────────────────────────
// Self-contained module: manages GameSettings state, renders the panel, and
// provides getSettings() for other modules to read current preferences.

import { getLang } from '../i18n'
import type { RegimeProfile } from '../sim/regime-config'

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
  _lockedFeatures = new Set(profile.lockedFeatures)
  _regimeVariant  = profile.variant

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

let _activeTab: 'ai_driven' = 'ai_driven'

// ── Render ─────────────────────────────────────────────────────────────────────

function renderPanel(): void {
  const vi = getLang() === 'vi'

  const regimeLabel = _regimeVariant !== 'default'
    ? `<div class="stg-regime-badge">${_regimeVariant}</div>`
    : ''

  panelBody.innerHTML = `
    ${regimeLabel}
    <div class="stg-tabs">
      <button class="stg-tab ${_activeTab === 'ai_driven' ? 'active' : ''}" data-tab="ai_driven">
        ${vi ? '🤖 AI-Driven' : '🤖 AI-Driven'}
      </button>
    </div>

    <div class="stg-tab-content" id="stg-content-ai_driven"
         style="display:${_activeTab === 'ai_driven' ? 'block' : 'none'}">

      ${renderToggleRow(
        'enable_human_elections',
        vi ? '🗳 Bầu cử nhân vật' : '🗳 Human-Driven Elections',
        vi ? 'NPCs bầu lãnh đạo thực sự. Worldview của người thắng ảnh hưởng chính sách.'
           : 'NPCs elect a real leader NPC. Their worldview biases all policy decisions.',
        _settings.enable_human_elections,
        _lockedFeatures.has('enable_human_elections'),
      )}

      ${_settings.enable_human_elections ? renderNumberRow(
        'election_cycle_days',
        vi ? 'Chu kỳ bầu cử (ngày)' : 'Election cycle (sim-days)',
        _settings.election_cycle_days,
        30, 360,
      ) : ''}

      <div class="stg-divider"></div>

      ${renderToggleRow(
        'enable_government_ai',
        vi ? '🏛 AI Chính sách' : '🏛 Government AI Policy',
        vi ? 'LLM tạo 2 lựa chọn chính sách mỗi 15 ngày. Tắt → dùng template cố định.'
           : 'LLM generates policy options every 15 days. Off → deterministic fallbacks.',
        _settings.enable_government_ai,
        _lockedFeatures.has('enable_government_ai'),
      )}

      ${renderToggleRow(
        'enable_npc_thoughts',
        vi ? '💭 Suy nghĩ NPC' : '💭 NPC Thought Generation',
        vi ? 'LLM tạo suy nghĩ hàng ngày khi click NPC. Tắt → dùng template.'
           : 'LLM generates daily thoughts in spotlight. Off → template fallback.',
        _settings.enable_npc_thoughts,
        _lockedFeatures.has('enable_npc_thoughts'),
      )}

      ${renderToggleRow(
        'enable_press_ai',
        vi ? '📰 Báo chí AI' : '📰 Press Headlines',
        vi ? 'AI tạo tiêu đề báo mỗi 5 ngày. Tắt → không có tin tức AI.'
           : 'AI generates newspaper headlines every 5 days. Off → no AI headlines.',
        _settings.enable_press_ai,
        _lockedFeatures.has('enable_press_ai'),
      )}

      ${renderToggleRow(
        'enable_consequence_prediction',
        vi ? '🔮 Dự đoán hậu quả' : '🔮 Consequence Prediction',
        vi ? 'AI dự đoán tác động lan truyền sau sự kiện. Tắt → không có dự đoán.'
           : 'AI predicts ripple effects after events. Off → no predictions shown.',
        _settings.enable_consequence_prediction,
        _lockedFeatures.has('enable_consequence_prediction'),
      )}

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
  const lockIcon = locked ? ' 🔒' : ''
  const lockTitle = locked ? ' (locked by regime)' : ''
  return `
    <div class="stg-row${locked ? ' stg-row-locked' : ''}">
      <div class="stg-row-info">
        <div class="stg-row-label">${label}${lockIcon}</div>
        <div class="stg-row-desc">${desc}${locked ? `<br><em style="color:#553;font-style:normal">Regime-locked${lockTitle}</em>` : ''}</div>
      </div>
      <div class="stg-toggle ${value ? 'on' : 'off'}${locked ? ' stg-toggle-locked' : ''}"
           data-toggle="${key}" data-locked="${locked ? '1' : '0'}"
           title="${value ? 'Enabled' : 'Disabled'}${lockTitle}">
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
