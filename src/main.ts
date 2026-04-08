import './css/main.css'
import type { AIConfig, AIProvider, Constitution, WorldState } from './types'
import { setupGreeting, setupChat, applyPreset, handlePlayerChat, resetInGameHistory, predictConsequences, generateConstitutionText } from './ai/god-agent'
import { listAvailableModels, PROVIDER_MODELS, getAIUsage, getRemainingRPM, getWaitSeconds } from './ai/provider'
import { addFeedRaw, addFeedThinking, setFeedFilter, setChronicleFilter, refreshChronicleTimestamps } from './ui/feed'
import { showConfirm, showInfo, showPolicyChoice, type PolicyDisplayCard } from './ui/modal'
import { initWorld, tick, spawnEvent, applyInterventions, applyInstantEventDeaths } from './sim/engine'
import {
  setLang,
  t,
  tf,
  populateLanguageSelect,
  getStoredLangPreference,
  isSupportedLang,
} from './i18n'
import { initMap, setMapPaused } from './ui/map'
import { runGovernmentCycle, detectRegime, type GovernmentPolicyAI } from './sim/government'
import { checkPressTrigger } from './sim/press'

// ── App state ──────────────────────────────────────────────────────────────

let aiConfig: AIConfig | null = null
let world: WorldState | null = null
let noApiKeyMode = false

type ThemeMode = 'dark' | 'light'
const THEME_KEY = 'sim_theme'

function applyTheme(theme: ThemeMode) {
  document.body.dataset.theme = theme
  const btn = document.getElementById('btn-theme')
  if (btn) {
    btn.textContent = theme === 'dark' ? '🌙' : '☀️'
    btn.setAttribute('title', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode')
  }
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY)
  const theme: ThemeMode = saved === 'light' ? 'light' : 'dark'
  applyTheme(theme)
}

function toggleTheme() {
  const current: ThemeMode = document.body.dataset.theme === 'light' ? 'light' : 'dark'
  const next: ThemeMode = current === 'light' ? 'dark' : 'light'
  applyTheme(next)
  localStorage.setItem(THEME_KEY, next)
}

initTheme()

// ── Screen management ──────────────────────────────────────────────────────

function showScreen(id: string) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'))
  document.getElementById(id)!.classList.add('active')
}

// ── Onboarding ─────────────────────────────────────────────────────────────

const btnStart       = document.getElementById('btn-start')!
const btnListModels  = document.getElementById('btn-list-models') as HTMLButtonElement
const apiKeyInput    = document.getElementById('api-key-input') as HTMLInputElement
const apiKeyRow      = document.getElementById('api-key-row')!
const baseUrlInput   = document.getElementById('base-url-input') as HTMLInputElement
const baseUrlRow     = document.getElementById('base-url-row')!
const providerSelect = document.getElementById('provider-select') as HTMLSelectElement
const modelSelect    = document.getElementById('model-select') as HTMLSelectElement
const tokenModeSelect = document.getElementById('token-mode-select') as HTMLSelectElement
const rpmLimitInput  = document.getElementById('rpm-limit-input') as HTMLInputElement
const onboardingErr  = document.getElementById('onboarding-error')!

let onboardingModelsReady = false

function resetModelSelect() {
  onboardingModelsReady = false
  modelSelect.innerHTML = ''
  const ph = document.createElement('option')
  ph.value = ''
  ph.textContent = t('onboarding.model_placeholder') as string
  ph.disabled = true
  ph.selected = true
  modelSelect.appendChild(ph)
  modelSelect.disabled = true
}

function applyFallbackModels(provider: AIProvider) {
  modelSelect.innerHTML = ''
  for (const id of PROVIDER_MODELS[provider]) {
    const opt = document.createElement('option')
    opt.value = id
    opt.textContent = id
    modelSelect.appendChild(opt)
  }
  modelSelect.disabled = false
  modelSelect.value = PROVIDER_MODELS[provider][0] ?? ''
  onboardingModelsReady = !!modelSelect.value
}

function updateProviderFieldLabels() {
  const provider = providerSelect.value as AIProvider
  const isCloud = provider === 'ollama_cloud'
  const baseLabel = document.getElementById('onboarding-base-url-label')
  if (baseLabel) {
    baseLabel.textContent = isCloud
      ? (t('onboarding.base_url_cloud') as string)
      : (t('onboarding.base_url') as string)
  }
  baseUrlInput.placeholder = isCloud
    ? (t('onboarding.base_url_cloud_ph') as string)
    : (t('onboarding.base_url_ph') as string)
  apiKeyInput.placeholder = isCloud
    ? (t('onboarding.api_key_cloud_ph') as string)
    : (t('onboarding.api_key_ph') as string)
}

function syncProviderFields() {
  const provider = providerSelect.value as AIProvider
  const isLocal = provider === 'ollama'
  const isCloud = provider === 'ollama_cloud'
  apiKeyRow.style.display = isLocal ? 'none' : ''
  const keyHintRow = document.getElementById('onboarding-key-hint-row')
  if (keyHintRow) keyHintRow.style.display = isLocal ? 'none' : ''
  baseUrlRow.style.display = isCloud ? '' : 'none'
  updateProviderFieldLabels()
  resetModelSelect()
}

providerSelect.addEventListener('change', syncProviderFields)

function initLanguageSelect() {
  const langSelect = document.getElementById('lang-select') as HTMLSelectElement | null
  if (!langSelect) return
  populateLanguageSelect(langSelect)
  const initial = getStoredLangPreference()
  langSelect.value = initial
  setLang(initial)
  updateProviderFieldLabels()
  langSelect.addEventListener('change', () => {
    const v = langSelect.value
    if (!isSupportedLang(v)) return
    setLang(v)
    updateProviderFieldLabels()
    refreshChronicleTimestamps()
  })
}

initLanguageSelect()
syncProviderFields()

function fillModelSelect(ids: string[]) {
  modelSelect.innerHTML = ''
  for (const id of ids) {
    const opt = document.createElement('option')
    opt.value = id
    opt.textContent = id
    modelSelect.appendChild(opt)
  }
  modelSelect.disabled = false
  modelSelect.value = ids[0] ?? ''
  onboardingModelsReady = ids.length > 0
}

btnListModels.addEventListener('click', async () => {
  const provider = providerSelect.value as AIProvider
  const isLocal = provider === 'ollama'
  const key = apiKeyInput.value.trim()
  const baseUrl = baseUrlInput.value.trim()

  if (!isLocal && !key) {
    showError(t('onboarding.err_no_key') as string)
    return
  }

  clearOnboardingError()
  const labelIdle = t('onboarding.btn_list_models') as string
  const labelBusy = t('onboarding.btn_list_models_loading') as string
  btnListModels.disabled = true
  btnListModels.textContent = labelBusy

  try {
    const models = await listAvailableModels({
      provider,
      key,
      base_url: baseUrl || undefined,
    })
    if (models.length === 0) throw new Error('empty')
    fillModelSelect(models)
  } catch {
    showError(`${t('onboarding.err_list_models') as string} ${t('onboarding.fallback_models_hint') as string}`)
    applyFallbackModels(provider)
  } finally {
    btnListModels.disabled = false
    btnListModels.textContent = labelIdle
  }
})

btnStart.addEventListener('click', async () => {
  const isLocal = providerSelect.value === 'ollama'
  const key = apiKeyInput.value.trim()
  const baseUrl = baseUrlInput.value.trim()
  if (!isLocal && !key) {
    showError(t('onboarding.err_no_key') as string)
    return
  }
  if (!onboardingModelsReady || !modelSelect.value) {
    showError(t('onboarding.err_models_first') as string)
    return
  }

  aiConfig = {
    provider: providerSelect.value as AIConfig['provider'],
    model: modelSelect.value,
    token_mode: tokenModeSelect.value as AIConfig['token_mode'],
    key,
    base_url: baseUrl || undefined,
    rpm_limit: Math.max(0, parseInt(rpmLimitInput.value, 10) || 0),
  }

  btnStart.textContent = t('onboarding.connecting') as string
  btnStart.setAttribute('disabled', 'true')

  try {
    showScreen('screen-setup')
    await startSetupConversation()
  } catch (e) {
    showScreen('screen-onboarding')
    showError(`${t('onboarding.err_conn')} ${(e as Error).message}`)
    btnStart.textContent = t('onboarding.btn_start') as string
    btnStart.removeAttribute('disabled')
  }
})

function clearOnboardingError() {
  onboardingErr.textContent = ''
  onboardingErr.classList.add('hidden')
}

function showError(msg: string) {
  onboardingErr.textContent = msg
  onboardingErr.classList.remove('hidden')
}

document.getElementById('btn-start-no-api')!.addEventListener('click', () => {
  noApiKeyMode = true
  aiConfig = null
  clearOnboardingError()
  setupMessages.innerHTML = ''
  // Hide text input row — only presets available without AI
  setupInputRow.style.display = 'none'
  const hintEl = document.querySelector<HTMLElement>('.setup-hint')
  if (hintEl) hintEl.textContent = t('setup.hint_no_api') as string
  showScreen('screen-setup')
})

// ── Setup conversation ─────────────────────────────────────────────────────

const setupMessages = document.getElementById('setup-messages')!
const setupInput    = document.getElementById('setup-input') as HTMLInputElement
const btnSetupSend  = document.getElementById('btn-setup-send')!
const setupInputRow = document.querySelector<HTMLElement>('.setup-input-row')!

async function startSetupConversation() {
  // Restore setup input row in case we were previously in no-API mode
  setupInputRow.style.display = ''
  const hintEl = document.querySelector<HTMLElement>('.setup-hint')
  if (hintEl) hintEl.textContent = t('setup.hint') as string

  appendAgentMsg('...')
  const greeting = await setupGreeting(aiConfig!)
  replaceLastMsg(greeting)
}

async function sendSetupMessage(text: string) {
  if (!text.trim()) return
  setupInput.value = ''
  appendPlayerMsg(text)
  appendAgentMsg('...')

  try {
    const { text: response, constitution } = await setupChat(text, aiConfig!)
    replaceLastMsg(response)

    if (constitution) {
      // God Agent confirmed — start the world after a brief pause
      setTimeout(() => startGame(constitution), 800)
    }
  } catch (e) {
    replaceLastMsg(`${t('err.generic')} ${(e as Error).message}`)
  }
}

btnSetupSend.addEventListener('click', () => sendSetupMessage(setupInput.value))
setupInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') sendSetupMessage(setupInput.value)
})

// Preset buttons
document.querySelectorAll('.btn-preset').forEach(btn => {
  btn.addEventListener('click', () => {
    const preset = (btn as HTMLElement).dataset.preset as 'nordic' | 'capitalist' | 'socialist' | 'feudal' | 'theocracy' | 'technocracy' | 'warlord' | 'commune' | 'marxist'
    const constitution = applyPreset(preset)
    appendPlayerMsg(`${t('setup.preset_msg')} ${btn.textContent}`)
    appendAgentMsg(`${t('setup.preset_init')} ${btn.textContent}...`)
    setTimeout(() => startGame(constitution), 600)
  })
})

function appendAgentMsg(text: string) {
  const el = document.createElement('div')
  el.className = 'msg agent'
  el.textContent = text
  setupMessages.appendChild(el)
  setupMessages.scrollTop = setupMessages.scrollHeight
}

function appendPlayerMsg(text: string) {
  const el = document.createElement('div')
  el.className = 'msg player'
  el.textContent = text
  setupMessages.appendChild(el)
  setupMessages.scrollTop = setupMessages.scrollHeight
}

function replaceLastMsg(text: string) {
  const msgs = setupMessages.querySelectorAll('.msg.agent')
  if (msgs.length > 0) msgs[msgs.length - 1].textContent = text
}

// ── Game start ─────────────────────────────────────────────────────────────

async function startGame(constitution: Constitution) {
  resetInGameHistory()
  lastGovernmentPeriod = -1  // reset government cycle tracker for new game

  // Show the game screen immediately so the user sees the UI rather than a frozen setup screen
  showScreen('screen-game')
  addFeedRaw(t('topbar.init') as string, 'info', 1, 1)

  try {
  // initWorld is now async — it yields every 50 NPCs so the UI stays responsive
  world = await initWorld(constitution)
  peakPopulation = countLivingNpcs(world)

  updateTopbar()
  updateDemographics()

  // Initialize the canvas map
  const mapCanvas = document.getElementById('map-canvas') as HTMLCanvasElement
  initMap(mapCanvas, () => world, () => aiConfig)

  // Resolve preset description keys through i18n
  const desc = constitution.description.startsWith('preset.')
    ? t(constitution.description) as string
    : constitution.description

  addFeedRaw(`${t('topbar.initialized')} ${desc}`, 'info', 1, 1)
  addFeedRaw(
    tf('topbar.constitution_set', {
      n: world.npcs.length,
      g: constitution.gini_start.toFixed(2),
      p: Math.round(constitution.state_power * 100),
    }),
    'info', 1, 1,
  )

  startSimLoop()

  // Disable chatbar when running without an API key
  if (noApiKeyMode) {
    chatInput.disabled = true
    chatInput.placeholder = t('chat.disabled') as string
    btnChatSend.setAttribute('disabled', 'true')
  }

  // ── AI-generated founding proclamation ────────────────────────────────────
  // After the world is running, ask the AI to draft a founding document.
  // Uses addFeedThinking pattern: shows a spinner, replaces it with the result.
  if (aiConfig) {
    const removeSpinner = addFeedThinking('📜 Drafting founding proclamation...')
    try {
      const proclamation = await generateConstitutionText(constitution, aiConfig)
      removeSpinner()
      addFeedRaw(`📜 ${proclamation}`, 'info', 1, 1)
    } catch {
      removeSpinner()
      // Silently skip — proclamation is a narrative flourish, not critical
    }
  }
  } catch (err) {
    console.error('[startGame] Initialization failed:', err)
    addFeedRaw(`⚠ Initialization error: ${err instanceof Error ? err.message : String(err)}`, 'critical', 1, 1)
  }
}

// ── Topbar ─────────────────────────────────────────────────────────────────

// Track macro stats from the previous daily tick to compute deltas
let _prevDailyMacro: { stability: number; food: number; natural_resources: number; energy: number; trust: number } | null = null

function updateTopbar() {
  if (!world) return
  const { macro, day, year } = world
  const month = Math.ceil(day / 30)

  document.getElementById('clock-label')!.textContent =
    tf('topbar.clock', { y: year, m: month, d: day })

  const regimeEl = document.getElementById('regime-label')
  if (regimeEl && world.constitution) {
    const regime = detectRegime(world.constitution)
    regimeEl.textContent = regime.charAt(0).toUpperCase() + regime.slice(1)
  }

  setStat('v-stability', macro.stability, 'stat-stability', 40, 25)
  setStat('v-food',      macro.food,      'stat-food',      35, 20)
  setStat('v-resources', macro.natural_resources, 'stat-resources', 30, 15)
  setStat('v-energy',    macro.energy,    'stat-energy',    35, 20)
  setStat('v-trust',     macro.trust,     'stat-trust',     35, 20)
  document.getElementById('v-gini')!.textContent = macro.gini.toFixed(2)

  const { requests, tokens } = getAIUsage()
  const tokStr = tokens >= 1000 ? `${(tokens / 1000).toFixed(1)}k` : `${tokens}`
  const rpm = aiConfig?.rpm_limit ?? 0
  const rpmStr = rpm > 0 ? ` · ${getRemainingRPM(rpm)}/${rpm} rpm` : ''
  document.getElementById('ai-usage')!.textContent = `${requests} req · ${tokStr} tok${rpmStr}`

  // Active events indicator — with tooltip showing per-event effects
  const evEl = document.getElementById('active-events')!
  const activeEvs = world.active_events
  if (activeEvs.length > 0) {
    const labels = activeEvs.map(ev => {
      const pct = Math.round((1 - ev.elapsed_ticks / ev.duration_ticks) * 100)
      const label = t(`event.${ev.type}`) ?? ev.type
      return `${label} ${pct}%`
    })
    evEl.textContent = `⚡ ${labels.join(' · ')}`
    evEl.classList.remove('hidden')
    // Tooltip: show zone + effects + days remaining
    const tips = activeEvs.map(ev => {
      const fx = ev.effects_per_tick
      const parts: string[] = []
      if (fx.food_stock_delta < 0) parts.push(`Food ${Math.round(fx.food_stock_delta * 24)}/day`)
      if (fx.stress_delta > 0)     parts.push(`Stress +${(fx.stress_delta * 24).toFixed(1)}/day`)
      if (fx.trust_delta < 0)      parts.push(`Trust ${(fx.trust_delta * 24).toFixed(1)}/day`)
      const daysLeft = Math.max(0, Math.ceil((ev.duration_ticks - ev.elapsed_ticks) / 24))
      const label = t(`event.${ev.type}`) ?? ev.type
      const zones = ev.zones.map(z => z.replace(/_/g, ' ')).join(', ')
      return `${label} — ${zones}\n  ${parts.join(', ') || 'ongoing'} — ${daysLeft}d left`
    })
    evEl.title = tips.join('\n\n')
  } else {
    evEl.classList.add('hidden')
    evEl.title = ''
  }
}

function setStat(valueId: string, value: number, statId: string, warnAt: number, dangerAt: number) {
  const el     = document.getElementById(valueId)!
  const parent = document.getElementById(statId)!
  el.textContent = `${Math.round(value)}%`
  parent.classList.remove('warn', 'danger', 'critical')
  if (value <= 20) parent.classList.add('critical')
  else if (value <= dangerAt) parent.classList.add('danger')
  else if (value <= warnAt) parent.classList.add('warn')
}

// ── Daily stat delta badges + crisis banner ─────────────────────────────────

const STAT_DELTA_DEFS = [
  { valueId: 'v-stability', statId: 'stat-stability', key: 'stability' as const },
  { valueId: 'v-food',      statId: 'stat-food',      key: 'food' as const },
  { valueId: 'v-resources', statId: 'stat-resources', key: 'natural_resources' as const },
  { valueId: 'v-energy',    statId: 'stat-energy',    key: 'energy' as const },
  { valueId: 'v-trust',     statId: 'stat-trust',     key: 'trust' as const },
]

function checkStatDeltas(macro: WorldState['macro']) {
  const prev = _prevDailyMacro
  _prevDailyMacro = {
    stability: macro.stability,
    food: macro.food,
    natural_resources: macro.natural_resources,
    energy: macro.energy,
    trust: macro.trust,
  }
  if (!prev) return

  let criticalCount = 0
  const criticalNames: string[] = []

  for (const { valueId, statId, key } of STAT_DELTA_DEFS) {
    const curr = macro[key]
    const delta = curr - prev[key]

    // Pulse animation for critical stats
    if (curr <= 20) {
      criticalCount++
      criticalNames.push(`${key.replace('natural_resources', 'Resources').replace('stability', 'Stability').replace('food', 'Food').replace('energy', 'Energy').replace('trust', 'Trust')} ${Math.round(curr)}%`)
    }

    // Delta badge for significant daily changes
    if (Math.abs(delta) >= 3) {
      const valueEl = document.getElementById(valueId)!
      // Remove stale badge if any
      valueEl.parentElement?.querySelector('.stat-delta')?.remove()
      const badge = document.createElement('span')
      badge.className = `stat-delta ${delta < 0 ? 'down' : 'up'}`
      badge.textContent = `${delta > 0 ? '▲' : '▼'}${Math.abs(Math.round(delta))}`
      badge.addEventListener('animationend', () => badge.remove(), { once: true })
      valueEl.insertAdjacentElement('afterend', badge)
    }

    // Remove stale badges for stats without notable change
    if (Math.abs(delta) < 3) {
      document.getElementById(statId)?.querySelector('.stat-delta')?.remove()
    }
  }

  // Crisis banner
  const banner = document.getElementById('crisis-banner')!
  if (criticalCount >= 3) {
    banner.textContent = `⚠ CIVILIZATION IN CRISIS — ${criticalNames.join(' · ')}`
    banner.classList.remove('hidden')
  } else {
    banner.classList.add('hidden')
  }
}

// ── Strike readiness warning ───────────────────────────────────────────────
// Fires a feed warning once per 3 days when a role is close to strike threshold.
// Threshold (engine.ts): solidarity > 72 AND grievance > 58 AND gini > 0.42
// We warn at 80% of those values and cooldown per role to avoid spam.

const _strikeWarnCooldown: Partial<Record<string, number>> = {}

function checkStrikeReadiness() {
  if (!world) return
  for (const role of STRIKEABLE_ROLES) {
    // Skip if already striking
    if (world.active_strikes.some(s => s.role === role)) continue

    // Cooldown: only warn once every 3 sim-days per role
    const lastWarn = _strikeWarnCooldown[role] ?? -999
    if (world.day - lastWarn < 3) continue

    let solSum = 0, grievSum = 0, count = 0
    for (const n of world.npcs) {
      if (!n.lifecycle.is_alive || n.role !== role) continue
      solSum   += n.class_solidarity ?? 0
      grievSum += n.grievance
      count++
    }
    if (count < 4) continue

    const avgSol   = solSum / count
    const avgGriev = grievSum / count

    if (avgSol >= WARN_SOL && avgGriev >= WARN_GRIEV && world.macro.gini > 0.42) {
      const solPct   = Math.round(avgSol)
      const grievPct = Math.round(avgGriev)
      const label    = role.charAt(0).toUpperCase() + role.slice(1)
      addFeedRaw(
        `⚠ ${label}s showing strike readiness — solidarity ${solPct}%, grievance ${grievPct}%`,
        'warning', world.year, world.day,
      )
      _strikeWarnCooldown[role] = world.day
    }
  }
}

function countLivingNpcs(w: WorldState): number {
  let c = 0
  for (const n of w.npcs) {
    if (n.lifecycle.is_alive) c++
  }
  return c
}

// ── Demographics panel ─────────────────────────────────────────────────────

const AGE_GROUPS = [
  { key: 'demo.age_0', min: 0,  max: 17 },
  { key: 'demo.age_1', min: 18, max: 34 },
  { key: 'demo.age_2', min: 35, max: 49 },
  { key: 'demo.age_3', min: 50, max: 69 },
  { key: 'demo.age_4', min: 70, max: 999 },
]

function updateDemographics() {
  if (!world) return

  let pop = 0
  let males = 0
  let leaving = 0
  const ageCounts = [0, 0, 0, 0, 0]

  for (const n of world.npcs) {
    if (!n.lifecycle.is_alive) continue
    pop++
    if (n.gender === 'male') males++
    if (n.action_state === 'fleeing') leaving++
    const a = n.age
    for (let i = 0; i < AGE_GROUPS.length; i++) {
      const g = AGE_GROUPS[i]
      if (a >= g.min && a <= g.max) {
        ageCounts[i]++
        break
      }
    }
  }

  const dead = world.npcs.length - pop

  document.getElementById('d-pop')!.textContent    = `${pop}`
  document.getElementById('d-male')!.textContent   = `${males}`
  document.getElementById('d-female')!.textContent = `${pop - males}`
  document.getElementById('d-deaths')!.textContent = `${dead}`
  document.getElementById('d-leaving')!.textContent = `${leaving}`
  document.getElementById('d-born')!.textContent = `${world.births_total ?? 0}`
  document.getElementById('d-immigrants')!.textContent = `${world.immigration_total ?? 0}`

  const container = document.getElementById('d-ages')!
  if (container.children.length === 0) {
    for (const g of AGE_GROUPS) {
      const label = t(g.key) as string
      const row = document.createElement('div')
      row.className = 'age-bar-row'
      row.innerHTML = `
        <span class="age-label">${label}</span>
        <div class="age-track"><div class="age-fill" data-age="${g.key}"></div></div>
        <span class="age-pct" data-age-pct="${g.key}"></span>
      `
      container.appendChild(row)
    }
  }

  const total = pop || 1
  for (let i = 0; i < AGE_GROUPS.length; i++) {
    const g = AGE_GROUPS[i]
    const count = ageCounts[i]
    const pct = Math.round(count / total * 100)
    const fill = container.querySelector<HTMLElement>(`.age-fill[data-age="${g.key}"]`)
    const pctEl = container.querySelector<HTMLElement>(`.age-pct[data-age-pct="${g.key}"]`)
    if (fill) fill.style.width = `${pct}%`
    if (pctEl) pctEl.textContent = `${pct}%`
  }

  updateLaborTension()
}

// ── Labor tension: per-role solidarity + grievance ─────────────────────────

const STRIKEABLE_ROLES = ['farmer', 'craftsman', 'merchant', 'scholar'] as const
// Strike thresholds (mirrors engine.ts checkLaborStrikes)
const STRIKE_SOL_THRESH = 72
const STRIKE_GRIEV_THRESH = 58
// Warn when within 80% of threshold
const WARN_SOL  = STRIKE_SOL_THRESH  * 0.80   // 57.6
const WARN_GRIEV = STRIKE_GRIEV_THRESH * 0.80   // 46.4

function updateLaborTension() {
  if (!world) return
  const laborEl = document.getElementById('d-labor')
  if (!laborEl) return

  type RoleStat = { sol: number; griev: number; count: number }
  const stats: Partial<Record<string, RoleStat>> = {}
  for (const role of STRIKEABLE_ROLES) stats[role] = { sol: 0, griev: 0, count: 0 }

  for (const n of world.npcs) {
    if (!n.lifecycle.is_alive) continue
    const s = stats[n.role]
    if (!s) continue
    s.sol   += n.class_solidarity ?? 0
    s.griev += n.grievance
    s.count++
  }

  const rows = STRIKEABLE_ROLES.map(role => {
    const s = stats[role]
    if (!s || s.count === 0) return ''
    const avgSol   = Math.round(s.sol / s.count)
    const avgGriev = Math.round(s.griev / s.count)
    const onStrike = world!.active_strikes.some(st => st.role === role)
    const atRisk   = avgSol >= WARN_SOL && avgGriev >= WARN_GRIEV
    const danger   = avgSol >= STRIKE_SOL_THRESH || onStrike

    const solColor   = danger ? '#e24b4b' : atRisk ? '#ef9f27' : '#2a6'
    const grievColor = avgGriev >= WARN_GRIEV ? '#ef9f27' : '#378add'
    const roleClass  = danger ? 'labor-role danger' : atRisk ? 'labor-role warn' : 'labor-role'
    const icon       = onStrike ? '⚒ ' : atRisk ? '⚠ ' : ''
    const label      = role.charAt(0).toUpperCase() + role.slice(1)

    return `<div class="labor-row">
      <span class="${roleClass}">${icon}${label}</span>
      <div class="labor-bars">
        <div class="labor-bar-track"><div class="labor-bar-fill" style="width:${avgSol}%;background:${solColor}"></div></div>
        <div class="labor-bar-track"><div class="labor-bar-fill" style="width:${avgGriev}%;background:${grievColor};opacity:.65"></div></div>
      </div>
      <span class="labor-vals">${avgSol}<br>${avgGriev}</span>
    </div>`
  }).join('')

  laborEl.innerHTML = `
    <div class="labor-section-title">⚒ Labor Tension</div>
    <div class="labor-legend">solidarity / grievance</div>
    ${rows}`
}

// ── Active rumors display ──────────────────────────────────────────────────

const RUMOR_EFFECT_ICONS: Record<string, string> = {
  trust_down:    '💔',
  trust_up:      '💚',
  fear_up:       '😨',
  grievance_up:  '😡',
}

function updateRumors() {
  if (!world) return
  const el = document.getElementById('d-rumors')
  if (!el) return
  const active = world.rumors.filter(r => r.expires_tick > world!.tick)
  if (active.length === 0) { el.innerHTML = ''; return }

  const totalNpcs = world.npcs.filter(n => n.lifecycle.is_alive).length || 1

  const rows = active.map(r => {
    const icon = RUMOR_EFFECT_ICONS[r.effect] ?? '💬'
    const reachPct = Math.round(Math.min(100, (r.reach / totalNpcs) * 100))
    const daysLeft = Math.max(0, Math.ceil((r.expires_tick - world!.tick) / 24))
    const text = r.content.length > 42 ? r.content.slice(0, 42) + '…' : r.content
    return `<div class="rumor-row">
      <span class="rumor-effect">${icon}</span>
      <span class="rumor-text" title="${r.content}">${text}</span>
      <span class="rumor-reach">${reachPct}% · ${daysLeft}d</span>
    </div>`
  }).join('')

  el.innerHTML = `<div class="rumor-title">💬 Rumors (${active.length})</div>${rows}`
}

// ── Consequence scheduler ──────────────────────────────────────────────────
// Scheduled NPC interventions predicted by AI after an event fires.

interface ScheduledConsequence {
  triggerDay: number   // world day on which to apply
  triggerYear: number
  label: string
  intervention: Parameters<typeof applyInterventions>[1][number]
}

const consequenceQueue: ScheduledConsequence[] = []

function flushConsequences() {
  if (!world) return
  const due = consequenceQueue.filter(c =>
    c.triggerYear < world!.year ||
    (c.triggerYear === world!.year && c.triggerDay <= world!.day),
  )
  for (const c of due) {
    const idx = consequenceQueue.indexOf(c)
    consequenceQueue.splice(idx, 1)
    const { affected } = applyInterventions(world, [c.intervention])
    addFeedRaw(
      `🌊 ${c.label} (${affected} affected)`,
      'warning', world.year, world.day,
    )
  }
}

// ── Simulation loop ────────────────────────────────────────────────────────

let paused = false
let speed = 1
let simInterval: ReturnType<typeof setInterval> | null = null
let peakPopulation = 0
const btnPause = document.getElementById('btn-pause')!
const btnTheme = document.getElementById('btn-theme')!
btnTheme.addEventListener('click', toggleTheme)

// Government cycle: runs once every 15 sim-days.
// Tracks which 15-day period has already been processed to avoid double-firing at high speeds.
let lastGovernmentPeriod = -1
let govBusy = false
const GOV_PERIOD_DAYS = 15

const govCdEl = document.getElementById('gov-cd')!
const btnGov  = document.getElementById('btn-gov')!

function updateGovCooldown() {
  if (!world) { govCdEl.textContent = '–'; return }
  if (govBusy) {
    govCdEl.textContent = '⏳'
    govCdEl.className = 'waiting'
    return
  }
  const nextGovDay = (lastGovernmentPeriod + 1) * GOV_PERIOD_DAYS
  const remaining = Math.max(0, nextGovDay - world.day)
  if (remaining === 0) {
    govCdEl.textContent = '✓'
    govCdEl.className = 'ready'
  } else {
    govCdEl.textContent = `${remaining}d`
    govCdEl.className = 'waiting'
  }
}

// Build a display card for showPolicyChoice from a GovernmentPolicyAI object
function buildPolicyCard(p: GovernmentPolicyAI): PolicyDisplayCard {
  const parts: string[] = []
  if ((p.food_delta ?? 0) > 0) parts.push('🍞 Food ↑')
  else if ((p.food_delta ?? 0) < 0) parts.push('🍞 Food ↓')
  if ((p.resource_delta ?? 0) > 0) parts.push('⛏ Resources ↑')
  if ((p.npc_grievance_delta ?? 0) < -3) parts.push('Grievance ↓')
  else if ((p.npc_grievance_delta ?? 0) > 3) parts.push('Grievance ↑')
  if ((p.npc_happiness_delta ?? 0) > 3) parts.push('😊 Happiness ↑')
  if ((p.npc_fear_delta ?? 0) > 3) parts.push('😨 Fear ↑')
  else if ((p.npc_fear_delta ?? 0) < -3) parts.push('Fear ↓')
  if ((p.npc_solidarity_delta ?? 0) < -5) parts.push('Solidarity ↓')
  else if ((p.npc_solidarity_delta ?? 0) > 5) parts.push('Solidarity ↑')
  return {
    label: p.option_label ?? (p.severity === 'critical' ? '⚠ Emergency' : '📋 Policy'),
    name: p.policy_name,
    desc: p.description,
    effects: parts.slice(0, 5).join(' · '),
    severity: p.severity,
  }
}

async function govPolicyCallback(opts: [GovernmentPolicyAI, GovernmentPolicyAI]): Promise<GovernmentPolicyAI> {
  const idx = await showPolicyChoice(buildPolicyCard(opts[0]), buildPolicyCard(opts[1]))
  return opts[idx]
}

async function triggerGovernment() {
  if (!world || govBusy) return
  govBusy = true
  updateGovCooldown()
  const rpmBudget = aiConfig ? getRemainingRPM(aiConfig.rpm_limit) : Infinity
  const govConfig = (rpmBudget >= 2) ? aiConfig : null
  lastGovernmentPeriod = Math.floor(world.day / GOV_PERIOD_DAYS)
  try {
    await runGovernmentCycle(world, govConfig, govPolicyCallback)
  } finally {
    govBusy = false
    updateGovCooldown()
  }
}

btnGov.addEventListener('click', () => { void triggerGovernment() })

// 1 tick = 1 sim-hour; 1000ms interval = 1 tick/second at 1× → 1 real second = 1 sim-hour
const BASE_TICK_MS = 1000

function setPaused(value: boolean) {
  paused = value
  setMapPaused(value)
  btnPause.textContent = paused ? '▶' : '⏸'
}

function startSimLoop() {
  if (simInterval) clearInterval(simInterval)
  simInterval = setInterval(() => {
    if (paused || !world) return
    const beforeIds = new Set(world.active_events.map(e => e.id))
    for (let i = 0; i < speed; i++) tick(world)
    // Detect events that expired this tick batch
    const afterIds = new Set(world.active_events.map(e => e.id))
    for (const id of beforeIds) {
      if (!afterIds.has(id)) {
        addFeedRaw(`✅ Event ended.`, 'info', world.year, world.day)
      }
    }
    const living = countLivingNpcs(world)
    if (living > peakPopulation) peakPopulation = living
    updateTopbar()
    if (world.tick % 24 === 0) {
      updateDemographics()
      updateRumors()
      flushConsequences()
      checkStatDeltas(world.macro)
      checkStrikeReadiness()
    }
    // Free press: every 5 sim-days — generates headlines before government reads them
    // If RPM budget is tight, press runs in template-only mode (pass null config)
    const rpmBudget = aiConfig ? getRemainingRPM(aiConfig.rpm_limit) : Infinity
    const pressConfig = (rpmBudget >= 3) ? aiConfig : null
    checkPressTrigger(world, pressConfig)
    // Government cycle: every GOV_PERIOD_DAYS sim-days
    const govPeriod = Math.floor(world.day / GOV_PERIOD_DAYS)
    if (govPeriod !== lastGovernmentPeriod && world.day >= GOV_PERIOD_DAYS && !govBusy) {
      const govConfig = (rpmBudget >= 2) ? aiConfig : null
      if (!govConfig && aiConfig) {
        const wait = getWaitSeconds(aiConfig.rpm_limit)
        addFeedRaw(
          tf('gov.policy_delayed', { seconds: Math.ceil(wait) }),
          'info', world.year, world.day,
        )
      }
      govBusy = true
      lastGovernmentPeriod = govPeriod
      runGovernmentCycle(world, govConfig, govPolicyCallback).finally(() => { govBusy = false; updateGovCooldown() })
    }
    updateGovCooldown()
    if (living === 0) triggerGameOver()
  }, BASE_TICK_MS)
}

// ── Game over ──────────────────────────────────────────────────────────────

function triggerGameOver() {
  if (!world) return
  if (simInterval) { clearInterval(simInterval); simInterval = null }

  addFeedRaw(t('engine.extinction') as string, 'critical', world.year, world.day)

  const summary = document.getElementById('gameover-summary')!
  const stats   = document.getElementById('gameover-stats')!

  const totalDays  = (world.year - 1) * 360 + world.day
  summary.textContent = tf('gameover.summary', {
    d:  totalDays,
    y:  world.year,
    ys: world.year !== 1 ? 's' : '',
  })
  const milestoneHtml = world.milestones.slice(-5).map(m =>
    `<div style="margin-top:4px;opacity:.85">${m.icon} <em>Year ${m.year}, Day ${m.day}</em> — ${m.text}</div>`,
  ).join('')

  stats.innerHTML = [
    tf('gameover.stats_pop', { n: peakPopulation }),
    tf('gameover.stats_day', { d: totalDays, ds: totalDays !== 1 ? 's' : '', y: world.year }),
  ].join('<br>') + (milestoneHtml ? `<div style="margin-top:10px;font-size:0.85em"><strong>Notable Milestones</strong>${milestoneHtml}</div>` : '')

  // Apply i18n to the static elements in the game-over screen
  document.getElementById('gameover-title-el')?.replaceChildren()
  document.querySelectorAll('#screen-gameover [data-i18n]').forEach(el => {
    const key = (el as HTMLElement).dataset.i18n!
    el.textContent = t(key) as string
  })

  showScreen('screen-gameover')
}

document.getElementById('btn-restart')!.addEventListener('click', () => {
  noApiKeyMode = false
  peakPopulation = 0
  world = null
  // Restore chatbar in case it was disabled in no-API mode
  const chatInputEl = document.getElementById('chat-input') as HTMLInputElement
  const btnChatSendEl = document.getElementById('btn-chat-send')!
  chatInputEl.disabled = false
  chatInputEl.placeholder = t('chat.ph') as string
  btnChatSendEl.removeAttribute('disabled')
  showScreen('screen-onboarding')
  // Reset the start button in case it was disabled
  const btnStart = document.getElementById('btn-start')!
  btnStart.textContent = t('onboarding.btn_start') as string
  btnStart.removeAttribute('disabled')
})

// ── Time controls ──────────────────────────────────────────────────────────

document.getElementById('btn-pause')!.addEventListener('click', function () {
  setPaused(!paused)
})

document.getElementById('btn-speed')!.addEventListener('click', function () {
  const prevSpeed = speed
  speed = speed === 1 ? 3 : speed === 3 ? 10 : 1
  this.textContent = `${speed}×`

  if (aiConfig && speed > prevSpeed) {
    const rpm = aiConfig.rpm_limit
    if (rpm > 0) {
      // At faster speeds sim-days pass faster → more government + press cycles per real minute.
      // At 1×: 1 real sec = 1 sim-hour → 1 sim-day ≈ 24s → ~2.5 days/min
      // At 3×: ~7.5 days/min  At 10×: ~25 days/min
      const daysPerMin = (speed * 60) / 24
      const govCallsPerMin = daysPerMin / 15
      const pressCallsPerMin = aiConfig.token_mode === 'unlimited' ? daysPerMin / 5 : 0
      const bgPerMin = govCallsPerMin + pressCallsPerMin
      const remaining = getRemainingRPM(rpm)
      const estimate = bgPerMin.toFixed(1)

      if (bgPerMin > rpm * 0.5) {
        addFeedRaw(
          `⚠️ Speed ${speed}× will use ~${estimate} AI calls/min for government` +
          (pressCallsPerMin > 0 ? ` + press` : '') +
          `. Your RPM limit is ${rpm}. ` +
          (remaining < 5 ? `Only ${remaining} calls left this minute — game may pause AI features until budget recovers.` : `${remaining} calls remaining.`),
          'warning',
          world?.year ?? 1,
          world?.day ?? 1,
        )
      }
    }
  }
})

// ── In-game chat ───────────────────────────────────────────────────────────

const chatInput   = document.getElementById('chat-input') as HTMLInputElement
const btnChatSend = document.getElementById('btn-chat-send')!

async function sendChatMessage() {
  const msg = chatInput.value.trim()
  if (!msg || !aiConfig || !world) return
  chatInput.value = ''
  btnChatSend.setAttribute('disabled', 'true')

  addFeedRaw(`"${msg}"`, 'player', world.year, world.day)

  // Pause game while waiting for AI response
  const wasPaused = paused
  setPaused(true)
  btnPause.textContent = t('topbar.ai_thinking') as string

  const removeThinking = addFeedThinking(t('err.thinking') as string)

  try {
    const response = await handlePlayerChat(msg, world, aiConfig)
    removeThinking()

    if (response.type === 'event' && response.event) {
      if (response.requires_confirm) {
        showConfirm({
          title: t('modal.event_title') as string,
          body: `<b>${response.answer}</b>${response.warning ? `<br><br>⚠ ${response.warning}` : ''}`,
          onConfirm: () => injectEvent(response),
          onCancel:  () => addFeedRaw(
            t('modal.event_cancelled') as string,
            'info', world!.year, world!.day,
          ),
        })
      } else {
        injectEvent(response)
      }
    } else if (response.type === 'intervention') {
      if (response.requires_confirm) {
        showConfirm({
          title: t('modal.event_title') as string,
          body: `<b>${response.answer}</b>${response.warning ? `<br><br>⚠ ${response.warning}` : ''}`,
          onConfirm: () => executeIntervention(response),
          onCancel:  () => addFeedRaw(
            t('modal.event_cancelled') as string,
            'info', world!.year, world!.day,
          ),
        })
      } else {
        executeIntervention(response)
      }
    } else {
      addFeedRaw(response.answer, 'info', world.year, world.day)
    }
  } catch (e) {
    removeThinking()
    addFeedRaw(
      `${t('err.generic')} ${(e as Error).message}`,
      'critical', world?.year ?? 1, world?.day ?? 1,
    )
  } finally {
    // Restore previous pause state
    setPaused(wasPaused)
    btnChatSend.removeAttribute('disabled')
  }
}

function injectEvent(response: Awaited<ReturnType<typeof handlePlayerChat>>) {
  if (!world || !response.event) return
  const narrative = response.event.narrative_open ?? response.answer
  addFeedRaw(narrative, 'warning', world.year, world.day)
  const spawned = spawnEvent(world, response.event)

  // Apply instant deaths for catastrophic events (nuclear_explosion, bombing, tsunami, etc.)
  const killed = applyInstantEventDeaths(world, spawned)
  if (killed > 0) {
    addFeedRaw(
      tf('engine.instant_deaths', { n: killed }) as string,
      'critical', world.year, world.day,
    )
  }

  // Async consequence prediction (non-blocking)
  void scheduleConsequences(response.event.type ?? 'event', narrative)
}

function executeIntervention(response: Awaited<ReturnType<typeof handlePlayerChat>>) {
  if (!world) return

  addFeedRaw(response.answer, 'warning', world.year, world.day)

  if (response.interventions?.length) {
    const { affected, killed } = applyInterventions(world, response.interventions)
    if (killed > 0) {
      addFeedRaw(
        tf('engine.instant_deaths', { n: killed }) as string,
        'critical', world.year, world.day,
      )
    }
    const survivors = affected - killed
    if (survivors > 0) {
      addFeedRaw(
        tf('engine.intervention', { n: survivors, s: '' }) as string,
        'warning', world.year, world.day,
      )
    }
  }

  // Companion event (e.g., radiation epidemic after nuclear bomb)
  if (response.event) {
    const narrative = response.event.narrative_open ?? ''
    if (narrative) addFeedRaw(narrative, 'warning', world!.year, world!.day)
    const spawned = spawnEvent(world, response.event)

    // Companion events (e.g. tsunami after bombing) can also have instant kills
    const companionKilled = applyInstantEventDeaths(world, spawned)
    if (companionKilled > 0) {
      addFeedRaw(
        tf('engine.instant_deaths', { n: companionKilled }) as string,
        'critical', world!.year, world!.day,
      )
    }
  }

  // Async consequence prediction (non-blocking)
  void scheduleConsequences(response.event?.type ?? 'intervention', response.answer)
}

async function scheduleConsequences(eventType: string, narrative: string) {
  if (!world || !aiConfig) return
  const prediction = await predictConsequences(eventType, narrative, world, aiConfig)
  if (!prediction || !world) return

  // Show prediction summary in feed
  addFeedRaw(`📡 ${prediction.summary}`, 'political', world.year, world.day)

  // Enqueue each consequence
  for (const c of prediction.consequences) {
    const targetDay = world.day + c.delay_days
    const extraYears = Math.floor(targetDay / 360)
    const day = ((targetDay - 1) % 360) + 1
    const year = world.year + extraYears

    consequenceQueue.push({
      triggerDay: day,
      triggerYear: year,
      label: c.label,
      intervention: {
        target: c.intervention.target as 'all' | 'zone' | 'role',
        zones: c.intervention.zones,
        roles: c.intervention.roles as Array<'farmer' | 'craftsman' | 'merchant' | 'scholar' | 'guard' | 'leader'> | undefined,
        count: c.intervention.count,
        action_state: c.intervention.action_state as never,
        stress_delta: c.intervention.stress_delta,
        fear_delta: c.intervention.fear_delta,
        hunger_delta: c.intervention.hunger_delta,
        grievance_delta: c.intervention.grievance_delta,
        happiness_delta: c.intervention.happiness_delta,
      },
    })
  }

  // Show upcoming cascade in feed
  if (prediction.consequences.length > 0) {
    const labels = prediction.consequences.map(c => `• [+${c.delay_days}d] ${c.label}`).join('\n')
    addFeedRaw(`⏳ Upcoming cascades:\n${labels}`, 'info', world.year, world.day)
  }
}

btnChatSend.addEventListener('click', sendChatMessage)
chatInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.isComposing) sendChatMessage()
})

// ── Constitution viewer ────────────────────────────────────────────────────

document.getElementById('btn-constitution')!.addEventListener('click', () => {
  if (!world) return
  const c = world.constitution
  const desc = c.description.startsWith('preset.') ? t(c.description) as string : c.description
  const pct = (v: number) => `${Math.round(v * 100)}%`
  const priorities = c.value_priority.map((v, i) => `${i + 1}. ${v}`).join(' · ')

  const row = (labelKey: string, value: string, hintKey: string) => `
    <tr>
      <td style="padding:6px 0 2px;color:#999;font-size:0.85em;white-space:nowrap">${t(labelKey)}</td>
      <td style="padding:6px 0 2px;font-weight:600;text-align:right">${value}</td>
    </tr>
    <tr>
      <td colspan="2" style="padding:0 0 8px;color:#444;font-size:0.78em;border-bottom:1px solid #1a1a1a">${t(hintKey)}</td>
    </tr>`

  const bodyHtml = `
    <div style="color:#bbb;font-size:0.95em;margin-bottom:12px;line-height:1.5;border-left:2px solid #2a5caa;padding-left:10px">${desc}</div>
    <table style="width:100%;border-collapse:collapse;font-size:0.88em">
      ${row('const.label_gini',     c.gini_start.toFixed(2),   'const.hint_gini')}
      ${row('const.label_market',   pct(c.market_freedom),     'const.hint_market')}
      ${row('const.label_state',    pct(c.state_power),        'const.hint_state')}
      ${row('const.label_safety',   pct(c.safety_net),         'const.hint_safety')}
      ${row('const.label_rights',   pct(c.individual_rights_floor), 'const.hint_rights')}
      ${row('const.label_trust',    pct(c.base_trust),         'const.hint_trust')}
      ${row('const.label_cohesion', pct(c.network_cohesion),   'const.hint_cohesion')}
      ${row('const.label_scarcity', pct(c.resource_scarcity),  'const.hint_scarcity')}
      <tr>
        <td style="padding:6px 0 2px;color:#999;font-size:0.85em">${t('const.label_values')}</td>
        <td style="padding:6px 0 2px;font-size:0.8em;text-align:right;color:#7aabff">${priorities}</td>
      </tr>
      <tr>
        <td colspan="2" style="padding:0 0 4px;color:#444;font-size:0.78em">${t('const.hint_values')}</td>
      </tr>
    </table>`

  showInfo(t('topbar.constitution') as string, bodyHtml)
})

// ── Log filter buttons ─────────────────────────────────────────────────────

document.getElementById('feed-filters')!.addEventListener('click', e => {
  const btn = (e.target as HTMLElement).closest('.log-filter-btn') as HTMLElement | null
  if (!btn) return
  document.querySelectorAll('#feed-filters .log-filter-btn').forEach(b => b.classList.remove('active'))
  btn.classList.add('active')
  setFeedFilter(btn.dataset.filter as 'all' | 'warning' | 'critical')
})

document.getElementById('chronicle-filters')!.addEventListener('click', e => {
  const btn = (e.target as HTMLElement).closest('.log-filter-btn') as HTMLElement | null
  if (!btn) return
  document.querySelectorAll('#chronicle-filters .log-filter-btn').forEach(b => b.classList.remove('active'))
  btn.classList.add('active')
  setChronicleFilter(btn.dataset.filter as 'minor' | 'major' | 'critical')
})

const chroniclePanel = document.getElementById('chronicle-panel') as HTMLElement
const chronicleResizer = document.getElementById('chronicle-resizer') as HTMLElement
chronicleResizer.addEventListener('pointerdown', (e: PointerEvent) => {
  e.preventDefault()
  chronicleResizer.setPointerCapture(e.pointerId)
  const startY = e.clientY
  const startHeight = chroniclePanel.getBoundingClientRect().height
  const minHeight = 120
  const maxHeight = Math.max(260, window.innerHeight - 260)

  const onMove = (ev: PointerEvent) => {
    const delta = startY - ev.clientY
    const next = Math.max(minHeight, Math.min(maxHeight, startHeight + delta))
    chroniclePanel.style.height = `${Math.round(next)}px`
  }
  const onUp = () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
})

