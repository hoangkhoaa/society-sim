import './css/main.css'
import type { AIConfig, AIProvider, Constitution, NPC, WorldState } from './types'
import { setupGreeting, setupChat, applyPreset, handlePlayerChat, resetInGameHistory, predictConsequences, generateConstitutionText } from './ai/god-agent'
import { listAvailableModels, PROVIDER_MODELS, getAIUsage, getRemainingRPM, initKeyRing } from './ai/provider'
import { addFeedRaw, addFeedThinking, setFeedFilter, setChronicleFilter, refreshChronicleTimestamps, addBreakthroughToLog } from './ui/feed'
import { showConfirm, showInfo, showPolicyChoice, type PolicyDisplayCard } from './ui/modal'
import { initWorld, tick, spawnEvent, applyInterventions, applyInstantEventDeaths, getIncomeTaxRate, MIN_NPC_COUNT, DEFAULT_NPC_COUNT, applyConstitutionPatch, applyWorldDelta, applyInstitutionDeltas, recordFormulaBreakthrough, GOD_AGENT_FORMULA_OVERRIDE_TITLE } from './engine'
import {
  setLang,
  t,
  tf,
  populateLanguageSelect,
  getStoredLangPreference,
  isSupportedLang,
} from './i18n'
import { initMap, setMapPaused, setMapLegendVisible, setMapNetworkVisible, setMapConflictOverlayVisible, triggerMapShake } from './ui/map'
import {
  resetNPCChatHistories,
  registerSpotlightCallbacks,
  openSpotlight,
  getNpcContactEntries,
  pruneDeadNpcContacts,
} from './ui/spotlight'
import { runGovernmentCycle, detectRegime, type GovernmentPolicyAI } from './sim/government'
import { checkPressTrigger, resetPressRuntimeState } from './sim/press'
import { checkScienceTrigger, resetScienceRuntimeState } from './sim/science'
import { resetNarrativeRuntimeState } from './sim/narratives'
import { getSettings, openSettingsPanel, applyRegimeDefaults } from './ui/settings-panel'
import { runElection } from './engine'
import { getRegimeProfile } from './sim/regime-config'
import { setActiveSimRestrictions } from './sim/npc'
import { isMarxistPresetEnabled } from './build-features'
import {
  THEME_STORAGE_KEY,
  UI_DEMOGRAPHICS_VISIBLE_KEY,
  UI_RUMORS_VISIBLE_KEY,
  UI_LEGEND_VISIBLE_KEY,
  UI_NETWORK_VISIBLE_KEY,
  UI_ECON_VISIBLE_KEY,
  UI_NPC_CONTACTS_VISIBLE_KEY,
  UI_CONFLICT_OVERLAY_KEY,
} from './constants/storage-keys'
import { ACHIEVEMENT_DEFINITIONS, type AchievementDef } from './constants/achievements'
import { DEMOGRAPHICS_AGE_GROUPS } from './constants/demographics-age-groups'
import {
  STRIKEABLE_ROLES,
  STRIKE_SOLIDARITY_THRESHOLD,
  STRIKE_WARN_SOLIDARITY,
  STRIKE_WARN_GRIEVANCE,
  STRIKE_READINESS_GINI_FLOOR,
} from './constants/labor-strikes'
import {
  TOPBAR_STAT_DELTA_DEFINITIONS,
  TOPBAR_STAT_DELTA_BADGE_MIN,
  TOPBAR_CRISIS_STAT_COUNT,
  TOPBAR_CRITICAL_THRESHOLD_PCT,
} from './constants/topbar-stat-deltas'
import { RUMOR_EFFECT_ICONS } from './constants/rumor-ui-icons'
import { SIM_BASE_TICK_MS, GOVERNMENT_POLICY_PERIOD_DAYS } from './constants/sim-loop-timing'
import { SPOTLIGHT_NPC_CONTACTS_CHANGED_EVENT } from './constants/spotlight-events'

// ── App state ──────────────────────────────────────────────────────────────

let aiConfig: AIConfig | null = null
let world: WorldState | null = null
let noApiKeyMode = false

type ThemeMode = 'dark' | 'light'

function applyTheme(theme: ThemeMode) {
  document.body.dataset.theme = theme
  const btn = document.getElementById('btn-theme')
  if (btn) {
    btn.textContent = theme === 'dark' ? '🌙' : '☀️'
    btn.setAttribute('title', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode')
  }
}

function initTheme() {
  const saved = localStorage.getItem(THEME_STORAGE_KEY)
  const theme: ThemeMode = saved === 'light' ? 'light' : 'dark'
  applyTheme(theme)
}

function toggleTheme() {
  const current: ThemeMode = document.body.dataset.theme === 'light' ? 'light' : 'dark'
  const next: ThemeMode = current === 'light' ? 'dark' : 'light'
  applyTheme(next)
  localStorage.setItem(THEME_STORAGE_KEY, next)
}

initTheme()

// ── Screen management ──────────────────────────────────────────────────────

function showScreen(id: string) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'))
  document.getElementById(id)!.classList.add('active')
}

function initOnboardingNetworkBackground() {
  const canvas = document.getElementById('onboarding-network-bg') as HTMLCanvasElement | null
  const host = document.getElementById('screen-onboarding')
  if (!canvas || !host) return

  type NetNode = { x: number; y: number; vx: number; vy: number; r: number }
  const nodes: NetNode[] = []
  const linksDistance = 135
  const nodeCount = window.innerWidth < 900 ? 24 : 42

  const resize = () => {
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1))
    const w = host.clientWidth
    const h = host.clientHeight
    canvas.width = Math.floor(w * dpr)
    canvas.height = Math.floor(h * dpr)
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    const ctx = canvas.getContext('2d')
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  const seedNodes = () => {
    nodes.length = 0
    const w = host.clientWidth
    const h = host.clientHeight
    for (let i = 0; i < nodeCount; i++) {
      nodes.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.45,
        vy: (Math.random() - 0.5) * 0.45,
        r: 1.4 + Math.random() * 1.9,
      })
    }
  }

  const draw = () => {
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const w = host.clientWidth
    const h = host.clientHeight
    ctx.clearRect(0, 0, w, h)

    if (!host.classList.contains('active')) {
      requestAnimationFrame(draw)
      return
    }

    const theme = document.body.dataset.theme === 'light' ? 'light' : 'dark'
    const lineColor = theme === 'light' ? '55, 97, 146' : '116, 167, 230'
    const dotColor = theme === 'light' ? '38, 78, 124' : '189, 225, 255'

    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i]
      a.x += a.vx
      a.y += a.vy
      if (a.x < 0 || a.x > w) a.vx *= -1
      if (a.y < 0 || a.y > h) a.vy *= -1
      a.x = Math.max(0, Math.min(w, a.x))
      a.y = Math.max(0, Math.min(h, a.y))

      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j]
        const dx = a.x - b.x
        const dy = a.y - b.y
        const dist = Math.hypot(dx, dy)
        if (dist > linksDistance) continue
        const alpha = (1 - dist / linksDistance) * (theme === 'light' ? 0.18 : 0.22)
        ctx.strokeStyle = `rgba(${lineColor}, ${alpha.toFixed(3)})`
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.stroke()
      }
    }

    for (const n of nodes) {
      ctx.fillStyle = `rgba(${dotColor}, ${theme === 'light' ? 0.72 : 0.82})`
      ctx.beginPath()
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2)
      ctx.fill()
    }

    requestAnimationFrame(draw)
  }

  resize()
  seedNodes()
  window.addEventListener('resize', () => {
    resize()
    seedNodes()
  })
  requestAnimationFrame(draw)
}

// ── Onboarding ─────────────────────────────────────────────────────────────

const btnStart       = document.getElementById('btn-start')!
const btnListModels  = document.getElementById('btn-list-models') as HTMLButtonElement
const apiKeyRow      = document.getElementById('api-key-row')!
const apiKeysContainer = document.getElementById('api-keys-container')!
const btnAddApiKey   = document.getElementById('btn-add-api-key') as HTMLButtonElement
const baseUrlInput   = document.getElementById('base-url-input') as HTMLInputElement
const baseUrlRow     = document.getElementById('base-url-row')!
const providerSelect = document.getElementById('provider-select') as HTMLSelectElement
const modelSelect    = document.getElementById('model-select') as HTMLSelectElement
const tokenModeSelect = document.getElementById('token-mode-select') as HTMLSelectElement
const rpmLimitInput  = document.getElementById('rpm-limit-input') as HTMLInputElement
const npcCountInput  = document.getElementById('npc-count-input') as HTMLInputElement
const onboardingErr  = document.getElementById('onboarding-error')!

let onboardingModelsReady = false

initOnboardingNetworkBackground()

function parseApiKeys(raw: string): string[] {
  return raw
    .split(',')
    .map(key => key.trim())
    .filter(key => key.length > 0)
}

function getAllApiKeys(): string[] {
  const all: string[] = []
  apiKeysContainer.querySelectorAll<HTMLInputElement>('.api-key-input')
    .forEach(inp => parseApiKeys(inp.value).forEach(k => all.push(k)))
  return all
}

function updateApiKeyRemoveButtons() {
  const rows = apiKeysContainer.querySelectorAll<HTMLElement>('.api-key-input-row')
  rows.forEach(row => {
    const btn = row.querySelector<HTMLButtonElement>('.btn-api-key-remove')!
    if (!btn) return
    btn.disabled = rows.length <= 1
    btn.style.opacity = rows.length <= 1 ? '0.3' : '1'
  })
}

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
  const firstKeyInput = apiKeysContainer.querySelector<HTMLInputElement>('.api-key-input')
  if (firstKeyInput) {
    firstKeyInput.placeholder = isCloud
      ? (t('onboarding.api_key_cloud_ph') as string)
      : (t('onboarding.api_key_ph') as string)
  }
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
    if (npcContactsVisible) updateNpcContactsPanel()
  })
}

initLanguageSelect()
syncProviderFields()

// ── API Key Rows ────────────────────────────────────────────────────────────
apiKeysContainer.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.btn-api-key-remove')
  if (!btn) return
  const row = btn.closest('.api-key-input-row')
  if (!row || apiKeysContainer.querySelectorAll('.api-key-input-row').length <= 1) return
  row.remove()
  updateApiKeyRemoveButtons()
})

btnAddApiKey.addEventListener('click', () => {
  const row = document.createElement('div')
  row.className = 'api-key-input-row'
  const inp = document.createElement('input')
  inp.type = 'password'
  inp.className = 'api-key-input'
  inp.autocomplete = 'off'
  inp.placeholder = 'API key'
  const rmBtn = document.createElement('button')
  rmBtn.type = 'button'
  rmBtn.className = 'btn-api-key-remove'
  rmBtn.title = 'Remove'
  rmBtn.textContent = '−'
  row.appendChild(inp)
  row.appendChild(rmBtn)
  apiKeysContainer.appendChild(row)
  updateApiKeyRemoveButtons()
  inp.focus()
})

updateApiKeyRemoveButtons()

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
  const keys = getAllApiKeys()
  const baseUrl = baseUrlInput.value.trim()

  if (!isLocal && keys.length === 0) {
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
      keys,
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
  const keys = getAllApiKeys()
  const baseUrl = baseUrlInput.value.trim()
  if (!isLocal && keys.length === 0) {
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
    keys,
    base_url: baseUrl || undefined,
    rpm_limit: Math.max(0, parseInt(rpmLimitInput.value, 10) || 0),
  }

  // Initialize the API key ring for health-aware round-robin
  initKeyRing(keys)

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

// Preset buttons (Marxist is opt-in via VITE_ENABLE_MARXIST_PRESET=true at build time)
if (!isMarxistPresetEnabled()) {
  document.querySelectorAll('.btn-preset[data-preset="marxist"]').forEach(el => el.remove())
}

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
  resetNPCChatHistories()
  lastGovernmentPeriod = -1  // reset government cycle tracker for new game
  _lastSimDay = -1
  // Clear age-bar rows so they are rebuilt fresh (correct language, correct counts)
  const dAges = document.getElementById('d-ages')
  if (dAges) dAges.innerHTML = ''
  resetNarrativeRuntimeState()
  resetPressRuntimeState()
  resetScienceRuntimeState()

  // Show the game screen immediately so the user sees the UI rather than a frozen setup screen
  showScreen('screen-game')
  addFeedRaw(t('topbar.init') as string, 'info', 1, 1)

  try {
  // initWorld is now async — it yields every 50 NPCs so the UI stays responsive
  const npcCount = Math.max(MIN_NPC_COUNT, parseInt(npcCountInput?.value || String(DEFAULT_NPC_COUNT), 10) || MIN_NPC_COUNT)
  world = await initWorld(constitution, npcCount)
  // Apply regime-specific defaults, locked features, and sim restrictions
  const regimeProfile = getRegimeProfile(constitution)
  applyRegimeDefaults(regimeProfile)
  setActiveSimRestrictions(regimeProfile.simRestrictions)

  updateTopbar()
  peakPopulation = updateDemographics()
  updateEconomicsPanel()
  updateNpcContactsPanel()

  // Initialize the canvas map
  const mapCanvas = document.getElementById('map-canvas') as HTMLCanvasElement
  initMap(mapCanvas, () => world, () => aiConfig, getSettings)

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

function getTopbarLevelKey(value: number, warnAt: number, dangerAt: number): 'tip-healthy' | 'tip-warning' | 'tip-danger' | 'tip-critical' {
  if (value <= 20) return 'tip-critical'
  if (value <= dangerAt) return 'tip-danger'
  if (value <= warnAt) return 'tip-warning'
  return 'tip-healthy'
}

function getTopbarLevel(value: number, warnAt: number, dangerAt: number): string {
  const key = getTopbarLevelKey(value, warnAt, dangerAt)
  return t(`topbar.tip_level_${key.replace('tip-', '')}`) as string
}

function buildStatTooltip(opts: {
  name: string
  value: string
  desc: string
  factors: string[]
  levelCls: string
  levelLabel: string
}): string {
  const factorsHtml = opts.factors.length
    ? `<div class="stat-tooltip-factors">${opts.factors.map(f => `<div class="stat-tooltip-factor">${f}</div>`).join('')}</div>`
    : ''
  return `
    <div class="stat-tooltip">
      <div class="stat-tooltip-name">${opts.name}</div>
      <div class="stat-tooltip-value ${opts.levelCls}">${opts.value}</div>
      <div class="stat-tooltip-desc">${opts.desc}</div>
      ${factorsHtml}
      <div class="stat-tooltip-status ${opts.levelCls}">${opts.levelLabel}</div>
    </div>`
}

function updateTopbarTooltips(macro: WorldState['macro']) {
  const setTip = (id: string, html: string) => {
    const el = document.getElementById(id)
    if (!el) return
    const existing = el.querySelector('.stat-tooltip')
    if (existing) {
      existing.outerHTML = html
    } else {
      const tmp = document.createElement('div')
      tmp.innerHTML = html
      if (tmp.firstElementChild) el.appendChild(tmp.firstElementChild)
    }
  }

  const stabilityLvl = getTopbarLevelKey(macro.stability, 40, 25)
  setTip('stat-stability', buildStatTooltip({
    name: t('topbar.stat_stability') as string,
    value: `${Math.round(macro.stability)}%`,
    desc: t('topbar.tip_stability') as string,
    factors: (t('topbar.tip_stability_factors') as string).split('|'),
    levelCls: stabilityLvl,
    levelLabel: getTopbarLevel(macro.stability, 40, 25),
  }))

  const foodLvl = getTopbarLevelKey(macro.food, 35, 20)
  setTip('stat-food', buildStatTooltip({
    name: t('topbar.stat_food') as string,
    value: `${Math.round(macro.food)}%`,
    desc: t('topbar.tip_food') as string,
    factors: (t('topbar.tip_food_factors') as string).split('|'),
    levelCls: foodLvl,
    levelLabel: getTopbarLevel(macro.food, 35, 20),
  }))

  const resLvl = getTopbarLevelKey(macro.natural_resources, 30, 15)
  setTip('stat-resources', buildStatTooltip({
    name: t('topbar.stat_resources') as string,
    value: `${Math.round(macro.natural_resources)}%`,
    desc: t('topbar.tip_resources') as string,
    factors: (t('topbar.tip_resources_factors') as string).split('|'),
    levelCls: resLvl,
    levelLabel: getTopbarLevel(macro.natural_resources, 30, 15),
  }))

  const energyLvl = getTopbarLevelKey(macro.energy, 35, 20)
  setTip('stat-energy', buildStatTooltip({
    name: t('topbar.stat_energy') as string,
    value: `${Math.round(macro.energy)}%`,
    desc: t('topbar.tip_energy') as string,
    factors: (t('topbar.tip_energy_factors') as string).split('|'),
    levelCls: energyLvl,
    levelLabel: getTopbarLevel(macro.energy, 35, 20),
  }))

  const trustLvl = getTopbarLevelKey(macro.trust, 35, 20)
  setTip('stat-trust', buildStatTooltip({
    name: t('topbar.stat_trust') as string,
    value: `${Math.round(macro.trust)}%`,
    desc: t('topbar.tip_trust') as string,
    factors: (t('topbar.tip_trust_factors') as string).split('|'),
    levelCls: trustLvl,
    levelLabel: getTopbarLevel(macro.trust, 35, 20),
  }))

  const giniLvl: 'tip-healthy' | 'tip-warning' | 'tip-danger' | 'tip-critical' =
    macro.gini >= 0.65 ? 'tip-critical' : macro.gini >= 0.50 ? 'tip-danger' : macro.gini >= 0.35 ? 'tip-warning' : 'tip-healthy'
  const giniLabel = t(`topbar.tip_level_${giniLvl.replace('tip-', '')}`) as string
  setTip('stat-gini', buildStatTooltip({
    name: t('topbar.stat_gini') as string,
    value: macro.gini.toFixed(2),
    desc: t('topbar.tip_gini') as string,
    factors: (t('topbar.tip_gini_factors') as string).split('|'),
    levelCls: giniLvl,
    levelLabel: giniLabel,
  }))
}

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
  updateTopbarTooltips(macro)

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

  for (const { valueId, statId, key, i18nKey } of TOPBAR_STAT_DELTA_DEFINITIONS) {
    const curr = macro[key]
    const delta = curr - prev[key]

    // Pulse animation for critical stats
    if (curr <= TOPBAR_CRITICAL_THRESHOLD_PCT) {
      criticalCount++
      criticalNames.push(`${t(i18nKey) as string} ${Math.round(curr)}%`)
    }

    // Delta badge for significant daily changes
    if (Math.abs(delta) >= TOPBAR_STAT_DELTA_BADGE_MIN) {
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
    if (Math.abs(delta) < TOPBAR_STAT_DELTA_BADGE_MIN) {
      document.getElementById(statId)?.querySelector('.stat-delta')?.remove()
    }
  }

  // Crisis banner
  const banner = document.getElementById('crisis-banner')!
  if (criticalCount >= TOPBAR_CRISIS_STAT_COUNT) {
    banner.textContent = `${t('crisis.banner') as string} — ${criticalNames.join(' · ')}`
    banner.classList.remove('hidden')
  } else {
    banner.classList.add('hidden')
  }
}

// ── Strike readiness warning ───────────────────────────────────────────────
// Fires a feed warning once per 3 days when a role is close to strike threshold.
// Threshold (engine/network-dynamics): solidarity > 72 AND grievance > 58 AND gini > 0.42
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

    if (avgSol >= STRIKE_WARN_SOLIDARITY && avgGriev >= STRIKE_WARN_GRIEVANCE && world.macro.gini > STRIKE_READINESS_GINI_FLOOR) {
      const solPct   = Math.round(avgSol)
      const grievPct = Math.round(avgGriev)
      const label    = t(`role.${role}`) as string || role
      addFeedRaw(
        tf('feed.strike_readiness', { role: label, sol: solPct, griev: grievPct }),
        'warning', world.year, world.day,
      )
      _strikeWarnCooldown[role] = world.day
    }
  }
}


// ── Achievements ───────────────────────────────────────────────────────────

function showAchievementToast(def: AchievementDef) {
  const container = document.getElementById('achievement-toast-container')
  if (!container) return

  const titleText = t(def.titleKey) as string
  const descText  = t(def.descKey) as string
  // Extract icon (first grapheme cluster — typically an emoji)
  const icon = [...titleText][0] ?? '🏅'
  // Title without the leading icon
  const titleBody = titleText.slice([...titleText][0]?.length ?? 1).trim()

  const toast = document.createElement('div')
  toast.className = 'achievement-toast'
  toast.innerHTML = `
    <div class="achievement-toast-icon">${icon}</div>
    <div class="achievement-toast-body">
      <div class="achievement-toast-label">${t('achievement.toast_new') as string}</div>
      <div class="achievement-toast-title">${titleBody}</div>
      <div class="achievement-toast-desc">${descText}</div>
    </div>`
  container.appendChild(toast)

  // Auto-dismiss after 5 s with slide-out animation
  setTimeout(() => {
    toast.classList.add('hiding')
    toast.addEventListener('animationend', () => toast.remove(), { once: true })
  }, 5000)
}

function checkAchievements(w: WorldState) {
  const totalDays = (w.year - 1) * 360 + w.day
  for (const def of ACHIEVEMENT_DEFINITIONS) {
    if (totalDays >= def.dayThreshold && !w.stats.achieved_days.includes(def.dayThreshold)) {
      w.stats.achieved_days.push(def.dayThreshold)
      showAchievementToast(def)
      addFeedRaw(
        `🏅 ${t(def.titleKey)}`,
        'info', w.year, w.day,
      )
    }
  }
}

// ── Demographics panel ─────────────────────────────────────────────────────

function updateDemographics(): number {
  if (!world) return 0

  let pop = 0
  let males = 0
  let leavingNow = 0   // currently fleeing (still alive)
  let fled = 0         // permanently emigrated (removed from population)
  let deaths = 0       // died from causes other than fleeing
  const ageCounts = [0, 0, 0, 0, 0]

  for (const n of world.npcs) {
    if (n.lifecycle.is_alive) {
      pop++
      if (n.gender === 'male') males++
      if (n.action_state === 'fleeing') leavingNow++
      const a = n.age
      for (let i = 0; i < DEMOGRAPHICS_AGE_GROUPS.length; i++) {
        const g = DEMOGRAPHICS_AGE_GROUPS[i]
        if (a >= g.min && a <= g.max) { ageCounts[i]++; break }
      }
    } else {
      if (n.lifecycle.death_cause === 'fled') fled++
      else deaths++
    }
  }

  document.getElementById('d-pop')!.textContent    = `${pop}`
  document.getElementById('d-male')!.textContent   = `${males}`
  document.getElementById('d-female')!.textContent = `${pop - males}`
  document.getElementById('d-deaths')!.textContent = `${deaths}`
  document.getElementById('d-leaving')!.textContent = `${fled}`
  document.getElementById('d-born')!.textContent = `${world.births_total ?? 0}`
  document.getElementById('d-immigrants')!.textContent = `${world.immigration_total ?? 0}`

  const container = document.getElementById('d-ages')!
  if (container.children.length === 0) {
    for (const g of DEMOGRAPHICS_AGE_GROUPS) {
      const label = t(g.i18nKey) as string
      const row = document.createElement('div')
      row.className = 'age-bar-row'
      row.innerHTML = `
        <span class="age-label">${label}</span>
        <div class="age-track"><div class="age-fill" data-age="${g.i18nKey}"></div></div>
        <span class="age-pct" data-age-pct="${g.i18nKey}"></span>
      `
      container.appendChild(row)
    }
  }

  const total = pop || 1
  for (let i = 0; i < DEMOGRAPHICS_AGE_GROUPS.length; i++) {
    const g = DEMOGRAPHICS_AGE_GROUPS[i]
    const count = ageCounts[i]
    const pct = Math.round(count / total * 100)
    const fill = container.querySelector<HTMLElement>(`.age-fill[data-age="${g.i18nKey}"]`)
    const pctEl = container.querySelector<HTMLElement>(`.age-pct[data-age-pct="${g.i18nKey}"]`)
    if (fill) fill.style.width = `${pct}%`
    if (pctEl) pctEl.textContent = `${pct}%`
  }

  updateLaborTension()
  return pop
}

// ── Labor tension: per-role solidarity + grievance ─────────────────────────

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
    const atRisk   = avgSol >= STRIKE_WARN_SOLIDARITY && avgGriev >= STRIKE_WARN_GRIEVANCE
    const danger   = avgSol >= STRIKE_SOLIDARITY_THRESHOLD || onStrike

    const solColor   = danger ? '#e24b4b' : atRisk ? '#ef9f27' : '#2a6'
    const grievColor = avgGriev >= STRIKE_WARN_GRIEVANCE ? '#ef9f27' : '#378add'
    const roleClass  = danger ? 'labor-role danger' : atRisk ? 'labor-role warn' : 'labor-role'
    const icon       = onStrike ? '⚒ ' : atRisk ? '⚠ ' : ''
    const label      = t(`role.${role}`) as string || role

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
    <div class="labor-section-title">${t('labor.title') as string}</div>
    <div class="labor-legend">${t('labor.legend') as string}</div>
    ${rows}`
}

// ── Active rumors display ──────────────────────────────────────────────────

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function buildRumorRows(active: WorldState['rumors'], totalNpcs: number, tickNow: number): string {
  return active.map(r => {
    const icon = RUMOR_EFFECT_ICONS[r.effect] ?? '💬'
    const reachPct = Math.round(Math.min(100, (r.reach / totalNpcs) * 100))
    const daysLeft = Math.max(0, Math.ceil((r.expires_tick - tickNow) / 24))
    const safeText = escapeHtml(r.content)
    const longText = r.content.length > 40
    // ~60px per second reading speed — longer text scrolls proportionally slower
    const duration = Math.max(10, Math.min(32, r.content.length / 4))

    const textHtml = longText
      ? `<span class="rumor-text rumor-text-marquee" style="--rumor-dur:${duration}s"><span class="rumor-track"><span class="rumor-copy">${safeText}</span><span class="rumor-gap">·</span><span class="rumor-copy">${safeText}</span></span></span>`
      : `<span class="rumor-text">${safeText}</span>`

    return `<div class="rumor-row">
      <span class="rumor-effect">${icon}</span>
      ${textHtml}
      <span class="rumor-reach">${reachPct}% · ${daysLeft}d</span>
    </div>`
  }).join('')
}

function updateRumors() {
  if (!world) return
  const overlayLog = document.getElementById('rumors-overlay-log')
  if (!overlayLog) return

  const active = world.rumors.filter(r => r.expires_tick > world!.tick)
  if (active.length === 0) {
    overlayLog.innerHTML = `<div class="rumor-empty">${t('rumors.empty') as string}</div>`
    return
  }

  const totalNpcs = world.npcs.filter(n => n.lifecycle.is_alive).length || 1
  const rows = buildRumorRows(active, totalNpcs, world.tick)
  const title = `<div class="rumor-title">${tf('rumors.title', { count: active.length })}</div>`
  overlayLog.innerHTML = `${title}${rows}`
}

// ── Referendum banner ──────────────────────────────────────────────────────

/** Compute live support % using the same logic as resolveReferendum in engine/politics. */
function computeReferendumSupport(state: WorldState): number {
  const ref = state.referendum
  if (!ref) return 0
  const living = state.npcs.filter(n => n.lifecycle.is_alive)
  if (living.length === 0) return 0
  let supportCount = 0
  for (const npc of living) {
    let supports = false
    switch (ref.field) {
      case 'safety_net':
        supports = npc.worldview.collectivism > 0.50 || npc.hunger > 50
        break
      case 'individual_rights_floor':
        supports = npc.worldview.authority_trust < 0.45 || npc.criminal_record
        break
      case 'market_freedom':
        supports = npc.worldview.risk_tolerance > 0.55 || npc.role === 'merchant'
        break
      case 'state_power':
        supports = npc.worldview.authority_trust > 0.60 || npc.role === 'guard' || npc.role === 'leader'
        break
    }
    if (supports) supportCount++
  }
  return Math.round(supportCount / living.length * 100)
}

function renderReferendumBanner(state: WorldState): void {
  const banner    = document.getElementById('referendum-banner')!
  const ref       = state.referendum

  if (!ref) {
    banner.classList.add('hidden')
    return
  }

  banner.classList.remove('hidden')

  const supportPct  = computeReferendumSupport(state)
  const daysLeft    = Math.max(0, Math.ceil((ref.expires_tick - state.tick) / 24))

  document.getElementById('ref-proposal')!.textContent   = ref.proposal_text
  ;(document.getElementById('ref-proposal')! as HTMLElement).title = ref.proposal_text
  document.getElementById('ref-support-pct')!.textContent = `${supportPct}%`
  ;(document.getElementById('ref-support-bar')! as HTMLElement).style.width = `${supportPct}%`
  document.getElementById('ref-countdown')!.textContent  = tf('referendum.days', { n: daysLeft }) as string
  document.getElementById('btn-ref-details')!.textContent = t('referendum.details_btn') as string
}

function openReferendumDetails(): void {
  if (!world?.referendum) return
  const r  = world.referendum
  const sp = computeReferendumSupport(world)
  const dl = Math.max(0, Math.ceil((r.expires_tick - world.tick) / 24))
  const fl = t(`referendum.modal_field_${r.field}`) as string
  const statusKey = sp > 50 ? 'referendum.modal_status_passing' : 'referendum.modal_status_failing'
  const statusColor = sp > 50 ? '#5dcaa5' : '#e24b4b'
  const bodyHtml = `
    <table style="width:100%;border-collapse:collapse;font-size:13px;line-height:1.7">
      <tr><td style="color:#888;padding-right:12px">${t('referendum.modal_proposal') as string}</td><td><b>${r.proposal_text}</b></td></tr>
      <tr><td style="color:#888">${t('referendum.modal_field') as string}</td><td>${fl}</td></tr>
      <tr><td style="color:#888">${t('referendum.modal_current') as string}</td><td>${Math.round(r.current_value * 100)}%</td></tr>
      <tr><td style="color:#888">${t('referendum.modal_proposed') as string}</td><td><b>${Math.round(r.proposed_value * 100)}%</b></td></tr>
      <tr><td style="color:#888">${t('referendum.modal_support') as string}</td>
        <td><b>${sp}%</b> <span style="font-size:11px;color:${statusColor}">(${t(statusKey) as string})</span></td></tr>
      <tr><td style="color:#888">${t('referendum.modal_expires') as string}</td><td>${tf('referendum.modal_days_remaining', { n: dl }) as string}</td></tr>
    </table>`
  showInfo(t('referendum.modal_title') as string, bodyHtml)
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

// ── Spotlight pause/resume ─────────────────────────────────────────────────
// Side panel (NPC chat / manual stat edit) should pause the sim for the whole session.
// openSubPanel may run multiple times while the side panel stays visible (e.g. clear chat);
// only the first open in a session captures whether we should resume on close.
let _spotlightWasPaused = false
let _sidePanelSessionOpen = false
registerSpotlightCallbacks(
  () => {
    if (!_sidePanelSessionOpen) {
      _spotlightWasPaused = paused
      if (!paused) setPaused(true)
      _sidePanelSessionOpen = true
    }
  },
  () => {
    _sidePanelSessionOpen = false
    if (!_spotlightWasPaused) setPaused(false)
  },
  () => { if (world) world.stats.npc_chats++ },
  () => { if (world) world.stats.npc_edits++ },
)
const btnPause = document.getElementById('btn-pause')!
const btnToggleDemo = document.getElementById('btn-toggle-demo') as HTMLButtonElement
const btnToggleRumors = document.getElementById('btn-toggle-rumors') as HTMLButtonElement
const btnToggleNetwork = document.getElementById('btn-toggle-network') as HTMLButtonElement
const btnToggleLegend = document.getElementById('btn-toggle-legend') as HTMLButtonElement
const btnToggleEcon = document.getElementById('btn-toggle-econ') as HTMLButtonElement
const btnToggleNpcContacts = document.getElementById('btn-toggle-npc-contacts') as HTMLButtonElement
const btnToggleConflict = document.getElementById('btn-toggle-conflict') as HTMLButtonElement
const panelsDropdown = document.getElementById('panels-dropdown') as HTMLElement | null
const btnPanelsToggle = document.getElementById('btn-panels-toggle') as HTMLButtonElement | null
btnPanelsToggle?.addEventListener('click', (e) => {
  e.stopPropagation()
  panelsDropdown?.classList.toggle('open')
})
document.addEventListener('click', (e) => {
  if (!panelsDropdown) return
  const t = e.target as Node
  if (panelsDropdown.contains(t)) return
  panelsDropdown.classList.remove('open')
})
const btnTheme = document.getElementById('btn-theme')!
btnTheme.addEventListener('click', toggleTheme)

document.getElementById('btn-settings')!.addEventListener('click', openSettingsPanel)
const demographicsPanel = document.getElementById('demographics') as HTMLElement
const rumorsPanel = document.getElementById('rumors-panel') as HTMLElement
const econPanel = document.getElementById('econ-panel') as HTMLElement
const npcContactsPanel = document.getElementById('npc-contacts-panel') as HTMLElement

let demographicsVisible = localStorage.getItem(UI_DEMOGRAPHICS_VISIBLE_KEY) !== '0'
let rumorsVisible = localStorage.getItem(UI_RUMORS_VISIBLE_KEY) !== '0'
/** Map legend off by default; set localStorage to '1' to opt in. */
let legendVisible = localStorage.getItem(UI_LEGEND_VISIBLE_KEY) === '1'
let networkVisible = localStorage.getItem(UI_NETWORK_VISIBLE_KEY) !== '0'
let econVisible = localStorage.getItem(UI_ECON_VISIBLE_KEY) === '1'
let npcContactsVisible = localStorage.getItem(UI_NPC_CONTACTS_VISIBLE_KEY) === '1'
let conflictOverlayVisible = localStorage.getItem(UI_CONFLICT_OVERLAY_KEY) === '1'

function applyOverlayVisibility() {
  demographicsPanel.classList.toggle('hidden', !demographicsVisible)
  rumorsPanel.classList.toggle('hidden', !rumorsVisible)
  econPanel.classList.toggle('hidden', !econVisible)
  npcContactsPanel.classList.toggle('hidden', !npcContactsVisible)
  setMapLegendVisible(legendVisible)
  setMapNetworkVisible(networkVisible)

  btnToggleDemo.classList.toggle('active', demographicsVisible)
  btnToggleRumors.classList.toggle('active', rumorsVisible)
  btnToggleNetwork.classList.toggle('active', networkVisible)
  btnToggleLegend.classList.toggle('active', legendVisible)
  btnToggleEcon.classList.toggle('active', econVisible)
  btnToggleNpcContacts.classList.toggle('active', npcContactsVisible)
  setMapConflictOverlayVisible(conflictOverlayVisible)
  btnToggleConflict.classList.toggle('active', conflictOverlayVisible)
}

btnToggleDemo.addEventListener('click', () => {
  demographicsVisible = !demographicsVisible
  localStorage.setItem(UI_DEMOGRAPHICS_VISIBLE_KEY, demographicsVisible ? '1' : '0')
  applyOverlayVisibility()
})

btnToggleRumors.addEventListener('click', () => {
  rumorsVisible = !rumorsVisible
  localStorage.setItem(UI_RUMORS_VISIBLE_KEY, rumorsVisible ? '1' : '0')
  applyOverlayVisibility()
})

btnToggleNetwork.addEventListener('click', () => {
  networkVisible = !networkVisible
  localStorage.setItem(UI_NETWORK_VISIBLE_KEY, networkVisible ? '1' : '0')
  applyOverlayVisibility()
})

btnToggleLegend.addEventListener('click', () => {
  legendVisible = !legendVisible
  localStorage.setItem(UI_LEGEND_VISIBLE_KEY, legendVisible ? '1' : '0')
  applyOverlayVisibility()
})

btnToggleEcon.addEventListener('click', () => {
  econVisible = !econVisible
  localStorage.setItem(UI_ECON_VISIBLE_KEY, econVisible ? '1' : '0')
  applyOverlayVisibility()
  if (econVisible) updateEconomicsPanel()
})

btnToggleNpcContacts.addEventListener('click', () => {
  npcContactsVisible = !npcContactsVisible
  localStorage.setItem(UI_NPC_CONTACTS_VISIBLE_KEY, npcContactsVisible ? '1' : '0')
  applyOverlayVisibility()
  if (npcContactsVisible) updateNpcContactsPanel()
})

btnToggleConflict.addEventListener('click', () => {
  conflictOverlayVisible = !conflictOverlayVisible
  localStorage.setItem(UI_CONFLICT_OVERLAY_KEY, conflictOverlayVisible ? '1' : '0')
  applyOverlayVisibility()
})

document.addEventListener(SPOTLIGHT_NPC_CONTACTS_CHANGED_EVENT, () => {
  if (npcContactsVisible) updateNpcContactsPanel()
})

applyOverlayVisibility()

// ── NPC contacts (spotlight / chat) ─────────────────────────────────────────

function updateNpcContactsPanel() {
  const list = document.getElementById('npc-contacts-list')
  if (!list || !world) return
  pruneDeadNpcContacts(world)
  const entries = getNpcContactEntries()
  if (entries.length === 0) {
    list.innerHTML = `<div class="npc-contacts-empty">${escapeHtml(t('npc_contacts.empty') as string)}</div>`
    return
  }
  const byId = new Map(world.npcs.map(n => [n.id, n]))
  const spotTitle = escapeHtml(t('npc_contacts.badge_spotlight') as string)
  const chatTitle = escapeHtml(t('npc_contacts.badge_chat') as string)

  const sorted = entries
    .map(e => {
      const npc = byId.get(e.id)
      return npc && npc.lifecycle.is_alive ? { e, npc } : null
    })
    .filter((x): x is { e: (typeof entries)[0]; npc: NPC } => x != null)
    .sort((a, b) => a.npc.name.localeCompare(b.npc.name))

  list.innerHTML = sorted
    .map(({ e, npc }) => {
      const badges = [
        e.spotlight ? `<span class="npc-contact-badge" title="${spotTitle}">👁</span>` : '',
        e.chatted ? `<span class="npc-contact-badge" title="${chatTitle}">💬</span>` : '',
      ].join('')
      return `<button type="button" class="npc-contact-row" data-npc-id="${npc.id}">
      <span class="npc-contact-name">${escapeHtml(npc.name)}</span>
      <span class="npc-contact-badges">${badges}</span>
    </button>`
    })
    .join('')

  list.querySelectorAll<HTMLButtonElement>('.npc-contact-row').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.npcId ?? '', 10)
      const npc = world!.npcs.find(n => n.id === id && n.lifecycle.is_alive)
      if (npc) openSpotlight(npc, world!, aiConfig)
    })
  })
}

// ── Economics Panel ─────────────────────────────────────────────────────────

function updateEconomicsPanel() {
  if (!world) return
  const { macro } = world
  const taxRate = getIncomeTaxRate(world)

  // ── Tab 1: Daily ──────────────────────────────────────────────────────────
  const gdpEl          = document.getElementById('ep-gdp')
  const extractEl      = document.getElementById('ep-extraction')
  const effEl          = document.getElementById('ep-efficiency')
  const taxRateEl      = document.getElementById('ep-tax-rate')
  const exportsEl      = document.getElementById('ep-exports')
  const importsEl      = document.getElementById('ep-imports')
  const tradeBalanceEl = document.getElementById('ep-trade-balance')
  const tradeRevenueEl = document.getElementById('ep-trade-revenue')
  const moneyPrintedEl = document.getElementById('ep-money-printed')
  const sanitationEl   = document.getElementById('ep-sanitation')
  const hospitalEl     = document.getElementById('ep-hospital')

  if (gdpEl) {
    const currentGdp = Math.round(macro.gdp ?? 0)
    let trendArrow = '→'
    let trendColor = '#ef9f27'
    if (_prevGdpForTrend > 0) {
      const pctChange = ((currentGdp - _prevGdpForTrend) / _prevGdpForTrend) * 100
      if (pctChange > 1.5) { trendArrow = '↑'; trendColor = '#5dcaa5' }
      else if (pctChange < -1.5) { trendArrow = '↓'; trendColor = '#e24b4b' }
    }
    gdpEl.innerHTML = `${currentGdp} <span style="color:${trendColor};font-size:0.85em">${trendArrow}</span>`
    if (_prevGdpForTrend !== currentGdp) _prevGdpForTrend = currentGdp
  }
  if (extractEl) {
    const ex = Math.round(macro.extraction_rate ?? 0)
    extractEl.textContent = `${ex}%`
    extractEl.style.color = ex < 30 ? '#e24b4b' : ex < 60 ? '#ef9f27' : '#5dcaa5'
  }
  if (effEl) {
    const ef = Math.round(macro.economic_efficiency ?? 0)
    effEl.textContent = `${ef}%`
    effEl.style.color = ef < 30 ? '#e24b4b' : ef < 55 ? '#ef9f27' : '#5dcaa5'
  }
  if (taxRateEl) taxRateEl.textContent = `${Math.round(taxRate * 100)}%`
  if (exportsEl) exportsEl.textContent = `${Math.round(world.trade_exports_last_day ?? 0)}`
  if (importsEl) importsEl.textContent = `${Math.round(world.trade_imports_last_day ?? 0)}`
  if (tradeBalanceEl) {
    const bal = world.trade_balance_last_day ?? 0
    tradeBalanceEl.textContent = `${Math.round(bal)}`
    tradeBalanceEl.style.color = bal < -20 ? '#e24b4b' : bal < 20 ? '#ef9f27' : '#5dcaa5'
  }
  if (tradeRevenueEl) {
    const rev = world.trade_revenue_last_day ?? 0
    tradeRevenueEl.textContent = `${Math.round(rev)}`
    tradeRevenueEl.style.color = rev < -10 ? '#e24b4b' : rev < 10 ? '#ef9f27' : '#5dcaa5'
  }
  if (moneyPrintedEl) {
    const printed = world.money_printed_last_day ?? 0
    moneyPrintedEl.textContent = `${Math.round(printed)}`
    moneyPrintedEl.style.color = printed > 0 ? '#ef9f27' : '#aaa'
  }
  if (sanitationEl) {
    const san = Math.round(world.public_health?.sanitation ?? 0)
    sanitationEl.textContent = `${san}%`
    sanitationEl.style.color = san < 20 ? '#e24b4b' : san < 50 ? '#ef9f27' : '#5dcaa5'
  }
  if (hospitalEl) {
    const active = (world.public_health?.hospital_capacity ?? 0) > 0
    hospitalEl.textContent = active
      ? String(t('econ.hospital_active'))
      : String(t('econ.hospital_none'))
    hospitalEl.style.color = active ? '#5dcaa5' : '#aaa'
  }

  // ── Tab 2: All-Time ───────────────────────────────────────────────────────
  const taxPoolEl      = document.getElementById('ep-tax-pool')
  const totalTaxesEl   = document.getElementById('ep-total-taxes')
  const moneySupplyEl  = document.getElementById('ep-money-supply')
  const inflationEl    = document.getElementById('ep-inflation')
  const totalPrintedEl = document.getElementById('ep-total-printed')
  const totalExportsEl = document.getElementById('ep-total-exports')
  const totalImportsEl = document.getElementById('ep-total-imports')
  const totalTradeRevEl= document.getElementById('ep-total-trade-rev')
  const peakGdpEl      = document.getElementById('ep-peak-gdp')
  const researchEl     = document.getElementById('ep-research')
  const discoveriesEl  = document.getElementById('ep-discoveries')

  if (taxPoolEl) {
    const pool = Math.round(world.tax_pool ?? 0)
    taxPoolEl.textContent = `${pool}`
    taxPoolEl.style.color = pool < 50 ? '#e24b4b' : pool < 200 ? '#ef9f27' : '#5dcaa5'
  }
  if (totalTaxesEl) totalTaxesEl.textContent = `${Math.round(world.total_taxes_collected ?? 0)}`
  if (moneySupplyEl) moneySupplyEl.textContent = `${Math.round(world.money_supply ?? 0)}`
  if (inflationEl) {
    const infPct = (world.inflation_rate ?? 0) * 100
    inflationEl.textContent = `${infPct.toFixed(1)}%`
    inflationEl.style.color = infPct >= 20 ? '#e24b4b' : infPct >= 8 ? '#ef9f27' : '#5dcaa5'
  }
  if (totalPrintedEl) {
    const tp = Math.round(world.total_money_printed ?? 0)
    totalPrintedEl.textContent = `${tp}`
    totalPrintedEl.style.color = tp > 500 ? '#e24b4b' : tp > 100 ? '#ef9f27' : '#aaa'
  }
  if (totalExportsEl) totalExportsEl.textContent = `${Math.round(world.total_exports ?? 0)}`
  if (totalImportsEl) totalImportsEl.textContent = `${Math.round(world.total_imports ?? 0)}`
  if (totalTradeRevEl) {
    const ttr = Math.round(world.total_trade_revenue ?? 0)
    totalTradeRevEl.textContent = `${ttr}`
    totalTradeRevEl.style.color = ttr < 0 ? '#e24b4b' : '#5dcaa5'
  }
  if (peakGdpEl) peakGdpEl.textContent = `${Math.round(world.peak_gdp ?? 0)}`
  if (researchEl) researchEl.textContent = `${Math.round(world.research_points ?? 0)}`
  if (discoveriesEl) {
    const count = world.discoveries?.length ?? 0
    discoveriesEl.textContent = count === 0 ? '–' : `${count} / ${5}`
    discoveriesEl.style.color = count >= 4 ? '#5dcaa5' : count >= 2 ? '#ef9f27' : '#aaa'
  }
}

// Government cycle: runs once every 15 sim-days.
// Tracks which 15-day period has already been processed to avoid double-firing at high speeds.
let lastGovernmentPeriod = -1
let govBusy = false

const govCdEl = document.getElementById('gov-cd')!
const btnGov  = document.getElementById('btn-gov')!

function updateGovCooldown() {
  if (!world) { govCdEl.textContent = '–'; return }
  if (govBusy) {
    govCdEl.textContent = '⏳'
    govCdEl.className = 'waiting'
    return
  }
  const nextGovDay = (lastGovernmentPeriod + 1) * GOVERNMENT_POLICY_PERIOD_DAYS
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
  if ((p.food_delta ?? 0) > 0) parts.push(t('policy.food_up') as string)
  else if ((p.food_delta ?? 0) < 0) parts.push(t('policy.food_down') as string)
  if ((p.resource_delta ?? 0) > 0) parts.push(t('policy.resources_up') as string)
  if ((p.npc_grievance_delta ?? 0) < -3) parts.push(t('policy.grievance_down') as string)
  else if ((p.npc_grievance_delta ?? 0) > 3) parts.push(t('policy.grievance_up') as string)
  if ((p.npc_happiness_delta ?? 0) > 3) parts.push(t('policy.happiness_up') as string)
  if ((p.npc_fear_delta ?? 0) > 3) parts.push(t('policy.fear_up') as string)
  else if ((p.npc_fear_delta ?? 0) < -3) parts.push(t('policy.fear_down') as string)
  if ((p.npc_solidarity_delta ?? 0) < -5) parts.push(t('policy.solidarity_down') as string)
  else if ((p.npc_solidarity_delta ?? 0) > 5) parts.push(t('policy.solidarity_up') as string)
  return {
    label: p.option_label ?? (p.severity === 'critical' ? '⚠ Emergency' : '📋 Policy'),
    name: p.policy_name,
    desc: p.description,
    effects: parts.slice(0, 5).join(' · '),
    severity: p.severity,
  }
}

async function govPolicyCallback(opts: [GovernmentPolicyAI, GovernmentPolicyAI]): Promise<GovernmentPolicyAI> {
  const idx = await showPolicyChoice(
    buildPolicyCard(opts[0]),
    buildPolicyCard(opts[1]),
    () => setPaused(true),
    () => setPaused(false)
  )
  if (world) world.stats.policy_count++
  return opts[idx]
}

async function triggerGovernment() {
  if (!world || govBusy) return
  govBusy = true
  updateGovCooldown()
  const settings = getSettings()
  // Let callAI(waitForSlot) handle RPM; do not skip LLM here — old rpmBudget>=2 blocked gov AI incorrectly.
  const govConfig = (settings.enable_government_ai && aiConfig) ? aiConfig : null
  const leaderNpc = (settings.enable_human_elections && world.leader_id != null)
    ? world.npcs[world.leader_id] ?? undefined
    : undefined
  lastGovernmentPeriod = Math.floor(world.day / GOVERNMENT_POLICY_PERIOD_DAYS)
  try {
    await runGovernmentCycle(world, govConfig, govPolicyCallback, leaderNpc)
  } finally {
    govBusy = false
    updateGovCooldown()
  }
}

btnGov.addEventListener('click', () => { void triggerGovernment() })
document.getElementById('btn-ref-details')!.addEventListener('click', openReferendumDetails)

// 1 tick = 1 sim-hour; 1000ms interval = 1 tick/second at 1× → 1 real second = 1 sim-hour

function setPaused(value: boolean) {
  paused = value
  setMapPaused(value)
  btnPause.textContent = paused ? '▶' : '⏸'
}

let _lastSimDay = -1
let _prevGdpForTrend = 0

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
    updateTopbar()
    // Referendum banner — updated every tick to keep support % and countdown live
    renderReferendumBanner(world)
    // Demographics updates every interval so numbers stay in sync with the sim
    // updateDemographics() also returns live pop count, avoiding a second scan
    const living = updateDemographics()
    if (living > peakPopulation) peakPopulation = living
    // Heavier daily panels only update once per sim-day (works at any speed setting)
    const currentDay = (world.year - 1) * 360 + world.day
    if (currentDay !== _lastSimDay) {
      _lastSimDay = currentDay
      updateRumors()
      updateEconomicsPanel()
      flushConsequences()
      checkStatDeltas(world.macro)
      checkStrikeReadiness()
      checkAchievements(world)
      if (npcContactsVisible) updateNpcContactsPanel()
    }
    // Free press: every 5 sim-days — generates headlines before government reads them
    // If RPM budget is tight, press runs in template-only mode (pass null config)
    const settings    = getSettings()
    const pressConfig = (settings.enable_press_ai && aiConfig) ? aiConfig : null
    checkPressTrigger(world, pressConfig)
    // Science discovery: probability-gated, fires rarely (~every 45–90 sim-days)
    const scienceConfig = (settings.enable_science_ai && aiConfig) ? aiConfig : null
    checkScienceTrigger(world, scienceConfig)
    // Election cycle: when human elections enabled, run every N sim-days
    if (settings.enable_human_elections) {
      const cycleLen = Math.max(30, settings.election_cycle_days)
      if (world.day > 0 && world.last_election_day >= 0
          && world.day - world.last_election_day >= cycleLen) {
        runElection(world)
      } else if (world.last_election_day < 0 && world.day >= 10) {
        // First election on day 10 (enough time for network to form)
        runElection(world)
      }
    }
    // Government cycle: every GOVERNMENT_POLICY_PERIOD_DAYS sim-days
    const govPeriod = Math.floor(world.day / GOVERNMENT_POLICY_PERIOD_DAYS)
    if (govPeriod !== lastGovernmentPeriod && world.day >= GOVERNMENT_POLICY_PERIOD_DAYS && !govBusy) {
      const govConfig = (settings.enable_government_ai && aiConfig) ? aiConfig : null
      govBusy = true
      lastGovernmentPeriod = govPeriod
      const _settings = getSettings()
      const _leaderNpc = (_settings.enable_human_elections && world.leader_id != null)
        ? world.npcs[world.leader_id] ?? undefined
        : undefined
      runGovernmentCycle(world, govConfig, govPolicyCallback, _leaderNpc).finally(() => { govBusy = false; updateGovCooldown() })
    }
    updateGovCooldown()
    if (living === 0) triggerGameOver('extinction')
    else if (world.collapse_phase === 'collapse') triggerGameOver('collapse')
  }, SIM_BASE_TICK_MS)
}

// ── Game over ──────────────────────────────────────────────────────────────

function triggerGameOver(reason: 'extinction' | 'collapse' = 'extinction') {
  if (!world) return
  if (simInterval) { clearInterval(simInterval); simInterval = null }

  const feedKey = reason === 'collapse' ? 'engine.societal_collapse' : 'engine.extinction'
  addFeedRaw(t(feedKey) as string, 'critical', world.year, world.day)

  const summary = document.getElementById('gameover-summary')!
  const stats   = document.getElementById('gameover-stats')!

  const totalDays = (world.year - 1) * 360 + world.day
  const summaryKey = reason === 'collapse' ? 'gameover.summary_collapse' : 'gameover.summary'
  summary.textContent = tf(summaryKey, {
    d:  totalDays,
    wd: world.day,
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

  // Override title for collapse vs extinction
  const titleEl = document.getElementById('gameover-title-el')
  if (titleEl) {
    titleEl.textContent = reason === 'collapse'
      ? t('gameover.title_collapse') as string
      : t('gameover.title') as string
  }

  document.querySelectorAll('#screen-gameover [data-i18n]').forEach(el => {
    const key = (el as HTMLElement).dataset.i18n!
    if (el !== titleEl) el.textContent = t(key) as string
  })

  // ── Achievement medals panel ──────────────────────────────────────────────
  const medalsEl = document.getElementById('gameover-medals')
  if (medalsEl) {
    const earned = ACHIEVEMENT_DEFINITIONS.filter(d => world!.stats.achieved_days.includes(d.dayThreshold))
    if (earned.length > 0) {
      medalsEl.innerHTML = earned.map(d => {
        const titleText = t(d.titleKey) as string
        const descText  = t(d.descKey) as string
        const icon = [...titleText][0] ?? '🏅'
        const titleBody = titleText.slice([...titleText][0]?.length ?? 1).trim()
        return `<div class="gameover-medal">
          <div class="gameover-medal-icon">${icon}</div>
          <div class="gameover-medal-title">${titleBody}</div>
          <div class="gameover-medal-desc">${descText}</div>
        </div>`
      }).join('')
    } else {
      medalsEl.innerHTML = ''
    }
  }

  // ── World report panel ────────────────────────────────────────────────────
  const reportEl = document.getElementById('gameover-report')
  if (reportEl && world) {
    const s = world.stats
    const initPop = world.initial_population
    const popGrowth = initPop > 0 ? Math.round(((peakPopulation - initPop) / initPop) * 100) : 0
    const regime = detectRegime(world.constitution)
    const regimeLabel = regime.charAt(0).toUpperCase() + regime.slice(1)

    const row = (labelKey: string, val: string | number) =>
      `<div class="gameover-report-row"><span>${t(labelKey) as string}</span><span>${val}</span></div>`

    reportEl.innerHTML = `
      <div class="gameover-report-title">${t('gameover.report_title')}</div>
      ${row('gameover.report_regime',           regimeLabel)}
      ${row('gameover.report_pop_growth',       `${popGrowth}%`)}
      ${row('gameover.report_min_pop',          s.min_population)}
      ${row('gameover.report_god_calls',        s.god_calls)}
      ${row('gameover.report_policies',         s.policy_count)}
      ${row('gameover.report_interventions',    s.intervention_count)}
      ${row('gameover.report_deaths_natural',   s.deaths_natural)}
      ${row('gameover.report_deaths_violent',   s.deaths_violent)}
      ${row('gameover.report_emigrations',      s.fled_total)}
      ${row('gameover.report_elections',        s.elections_held)}
      ${row('gameover.report_npc_chats',        s.npc_chats)}
      ${row('gameover.report_npc_edits',        s.npc_edits)}
    `
  }

  // Phase-out: fade the game world to black over ~3 s, then reveal the game-over screen
  const veil = document.getElementById('gameover-veil')
  if (veil) {
    veil.classList.remove('clearing')
    veil.classList.add('fading')
    setTimeout(() => {
      showScreen('screen-gameover')
      // Fade the veil away so the gameover screen shows through
      veil.classList.remove('fading')
      veil.classList.add('clearing')
      setTimeout(() => {
        veil.classList.remove('clearing')
        veil.style.opacity = '0'
        veil.style.pointerEvents = 'none'
      }, 900)
    }, 3200)
  } else {
    showScreen('screen-gameover')
  }
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
  // Go straight to the society-design screen and start a fresh setup conversation
  if (aiConfig) {
    showScreen('screen-setup')
    startSetupConversation().catch(() => showScreen('screen-onboarding'))
  } else {
    // No AI config (no-API mode) — fall back to onboarding so user can enter a key
    showScreen('screen-onboarding')
    const btnStart = document.getElementById('btn-start')!
    btnStart.textContent = t('onboarding.btn_start') as string
    btnStart.removeAttribute('disabled')
  }
})

// ── Voluntary apocalypse (End Game button) ─────────────────────────────────

document.getElementById('btn-end-game')?.addEventListener('click', () => {
  if (!world) return
  // Close the panels dropdown first
  document.getElementById('panels-dropdown')?.classList.remove('open')
  showConfirm({
    title: t('endgame.confirm_title') as string,
    body:  t('endgame.confirm_body') as string,
    onConfirm: triggerApocalypse,
    onCancel: () => {},
  })
})

function triggerApocalypse() {
  if (!world) return
  if (simInterval) { clearInterval(simInterval); simInterval = null }

  // Feed announcement
  addFeedRaw(t('endgame.feed') as string, 'critical', world.year, world.day)

  // Map: initial rumble as meteor approaches (~800ms), then massive impact flash + long shake
  triggerMapShake(800, 6)
  setTimeout(() => triggerMapShake(3500, 28, true), 900)  // impact: intense shake + orange flash

  // Spawn a global meteor_strike event at max intensity covering all zones
  const ev = spawnEvent(world, {
    type: 'meteor_strike',
    intensity: 1.0,
    zones: [
      'north_farm','south_farm','workshop_district','market_square',
      'scholar_quarter','residential_east','residential_west','guard_post','plaza',
    ],
    duration_ticks: 1,
    narrative_open: '',
  })

  // Kill every single living NPC — no survivors
  for (const npc of world.npcs) {
    if (!npc.lifecycle.is_alive) continue
    npc.lifecycle.is_alive    = false
    npc.lifecycle.death_cause = 'accident'
    npc.lifecycle.death_tick  = world.tick
  }

  // Drain all resources to make the world state clearly dead
  world.food_stock       = 0
  world.natural_resources = 0
  world.macro.stability  = 0
  world.macro.trust      = 0

  // Dramatic pause: let the shake + flash play out before fade-to-black
  void ev  // suppress unused warning
  setTimeout(() => triggerGameOver('extinction'), 4500)
}

// ── Download achievement badge ─────────────────────────────────────────────

document.getElementById('btn-download-badge')?.addEventListener('click', () => {
  if (!world) return
  downloadAchievementBadge()
})

function downloadAchievementBadge() {
  if (!world) return

  const W = 680, H = 440
  const DPR = 2
  const canvas = document.createElement('canvas')
  canvas.width  = W * DPR
  canvas.height = H * DPR
  const ctx = canvas.getContext('2d')!
  ctx.scale(DPR, DPR)

  const s         = world.stats
  const totalDays = (world.year - 1) * 360 + world.day
  const regime    = detectRegime(world.constitution)
  const popGrowth = world.initial_population > 0
    ? Math.round(((peakPopulation - world.initial_population) / world.initial_population) * 100)
    : 0
  const earned = ACHIEVEMENT_DEFINITIONS.filter(d => s.achieved_days.includes(d.dayThreshold))
  const descRaw = world.constitution.description
  const desc = (descRaw.startsWith('preset.') ? (t(descRaw) as string) : descRaw)
  const PAD = 28

  // ── Background ────────────────────────────────────────────────────────────
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H)
  bgGrad.addColorStop(0,   '#0e0b08')
  bgGrad.addColorStop(1,   '#130d08')
  ctx.fillStyle = bgGrad
  ctx.fillRect(0, 0, W, H)

  // ── Ornamental border ─────────────────────────────────────────────────────
  // Outer frame
  ctx.strokeStyle = '#5a3a12'
  ctx.lineWidth = 1.5
  ctx.strokeRect(PAD, PAD, W - PAD * 2, H - PAD * 2)

  // Inner frame (offset 5px)
  ctx.strokeStyle = '#3a2408'
  ctx.lineWidth = 0.7
  ctx.strokeRect(PAD + 5, PAD + 5, W - (PAD + 5) * 2, H - (PAD + 5) * 2)

  // Corner ornaments — small diamond at each corner
  const corners = [
    [PAD, PAD], [W - PAD, PAD], [PAD, H - PAD], [W - PAD, H - PAD],
  ] as [number, number][]
  corners.forEach(([cx, cy]) => {
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(Math.PI / 4)
    ctx.fillStyle = '#7a5018'
    ctx.fillRect(-5, -5, 10, 10)
    ctx.strokeStyle = '#c08030'
    ctx.lineWidth = 0.8
    ctx.strokeRect(-5, -5, 10, 10)
    ctx.restore()
  })

  // Mid-edge ornament dots
  const mids = [
    [W / 2, PAD], [W / 2, H - PAD], [PAD, H / 2], [W - PAD, H / 2],
  ] as [number, number][]
  mids.forEach(([mx, my]) => {
    ctx.beginPath()
    ctx.arc(mx, my, 3.5, 0, Math.PI * 2)
    ctx.fillStyle = '#7a5018'
    ctx.fill()
    ctx.strokeStyle = '#c08030'
    ctx.lineWidth = 0.7
    ctx.stroke()
  })

  // Decorative corner scrollwork lines (short diagonal strokes toward center)
  const scrollLen = 18
  const scrollOff = PAD + 10
  ;([
    [scrollOff,      scrollOff,      1,  1],
    [W - scrollOff,  scrollOff,     -1,  1],
    [scrollOff,      H - scrollOff,  1, -1],
    [W - scrollOff,  H - scrollOff, -1, -1],
  ] as [number, number, number, number][]).forEach(([sx, sy, dx, dy]) => {
    ctx.strokeStyle = '#5a3a12'
    ctx.lineWidth = 0.8
    ctx.beginPath()
    ctx.moveTo(sx, sy); ctx.lineTo(sx + dx * scrollLen, sy)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(sx, sy); ctx.lineTo(sx, sy + dy * scrollLen)
    ctx.stroke()
  })

  // ── Header ────────────────────────────────────────────────────────────────
  const headerY = PAD + 18

  // Top flourish line pair
  const flourishGrad = ctx.createLinearGradient(PAD + 20, 0, W - PAD - 20, 0)
  flourishGrad.addColorStop(0,    'transparent')
  flourishGrad.addColorStop(0.25, '#7a5018')
  flourishGrad.addColorStop(0.75, '#7a5018')
  flourishGrad.addColorStop(1,    'transparent')

  const drawFlourishLine = (y: number) => {
    ctx.strokeStyle = flourishGrad
    ctx.lineWidth = 0.6
    ctx.beginPath(); ctx.moveTo(PAD + 20, y); ctx.lineTo(W - PAD - 20, y); ctx.stroke()
  }

  // Game name
  ctx.textAlign = 'center'
  ctx.fillStyle = '#c07828'
  ctx.font = 'bold 11px Georgia, serif'
  ctx.letterSpacing = '0.22em'
  ctx.fillText('✦  SOCIETY  SIMULATION  ✦', W / 2, headerY)
  ctx.letterSpacing = '0'

  drawFlourishLine(headerY + 7)

  // Society title
  ctx.fillStyle = '#f5e8d0'
  ctx.font = 'bold 20px Georgia, serif'
  const shortDesc = desc.length > 46 ? desc.slice(0, 44) + '…' : desc
  ctx.fillText(shortDesc, W / 2, headerY + 28)

  // Regime · Year · Days subtitle
  ctx.fillStyle = '#9a7840'
  ctx.font = '11px Georgia, serif'
  ctx.fillText(
    `${regime.charAt(0).toUpperCase() + regime.slice(1)}  ·  Year ${world.year}, Day ${world.day}  ·  ${totalDays} days`,
    W / 2, headerY + 46,
  )

  drawFlourishLine(headerY + 56)

  // ── Medals ────────────────────────────────────────────────────────────────
  const medalCY = headerY + 100
  if (earned.length > 0) {
    const spacing = Math.min(108, (W - 80) / earned.length)
    const totalMW = spacing * earned.length
    const startMX = (W - totalMW) / 2 + spacing / 2

    earned.forEach((def, i) => {
      const mx = startMX + i * spacing

      // Outer ring
      ctx.beginPath()
      ctx.arc(mx, medalCY, 27, 0, Math.PI * 2)
      const ringG = ctx.createLinearGradient(mx - 27, medalCY - 27, mx + 27, medalCY + 27)
      ringG.addColorStop(0,   '#f0d060')
      ringG.addColorStop(0.4, '#9a6810')
      ringG.addColorStop(1,   '#f0d060')
      ctx.strokeStyle = ringG
      ctx.lineWidth = 2
      ctx.stroke()

      // Inner fill
      ctx.beginPath()
      ctx.arc(mx, medalCY, 24, 0, Math.PI * 2)
      const fillG = ctx.createRadialGradient(mx, medalCY - 6, 3, mx, medalCY, 24)
      fillG.addColorStop(0, '#2a1e06')
      fillG.addColorStop(1, '#0e0a02')
      ctx.fillStyle = fillG
      ctx.fill()

      // Inner thin ring
      ctx.beginPath()
      ctx.arc(mx, medalCY, 24, 0, Math.PI * 2)
      ctx.strokeStyle = '#6a4808'
      ctx.lineWidth = 0.6
      ctx.stroke()

      // Emoji
      ctx.font = '18px system-ui, sans-serif'
      ctx.textAlign = 'center'
      const titleText = t(def.titleKey) as string
      const icon = [...titleText][0] ?? '🏅'
      ctx.fillText(icon, mx, medalCY + 6)

      // Label
      const label = titleText.slice([...titleText][0]?.length ?? 1).trim()
      ctx.fillStyle = '#c8a030'
      ctx.font = '7px Georgia, serif'
      ctx.letterSpacing = '0.03em'
      ctx.fillText(label.toUpperCase().slice(0, 16), mx, medalCY + 40)
      ctx.letterSpacing = '0'
    })
  } else {
    ctx.fillStyle = '#4a3018'
    ctx.font = 'italic 11px Georgia, serif'
    ctx.textAlign = 'center'
    ctx.fillText('— No milestones reached —', W / 2, medalCY + 6)
  }

  // ── Divider ───────────────────────────────────────────────────────────────
  const divY = medalCY + 56
  drawFlourishLine(divY)
  ctx.fillStyle = '#7a5018'
  ctx.font = '9px Georgia, serif'
  ctx.letterSpacing = '0.18em'
  ctx.textAlign = 'center'
  ctx.fillText('WORLD  CHRONICLE', W / 2, divY - 5)
  ctx.letterSpacing = '0'
  drawFlourishLine(divY - 14)

  // ── Stats (classic 2-col layout) ──────────────────────────────────────────
  const statRows: [string, string][] = [
    ['Peak population',   String(peakPopulation)],
    ['Lowest population', String(s.min_population)],
    ['Population growth', `${popGrowth > 0 ? '+' : ''}${popGrowth}%`],
    ['God Agent calls',   String(s.god_calls)],
    ['Policies enacted',  String(s.policy_count)],
    ['Interventions',     String(s.intervention_count)],
    ['NPC conversations', String(s.npc_chats)],
    ['Manual NPC edits',  String(s.npc_edits)],
    ['Elections held',    String(s.elections_held)],
    ['Emigrations',       String(s.fled_total)],
  ]

  const col1x = PAD + 22, col2x = W / 2 + 16
  const rowH = 20, statsY = divY + 14

  statRows.forEach(([label, val], i) => {
    const cx  = i < 5 ? col1x : col2x
    const row = i < 5 ? i : i - 5
    const ry  = statsY + row * rowH

    // Subtle alternating row tint
    if (row % 2 === 0) {
      ctx.fillStyle = 'rgba(255,200,100,0.025)'
      ctx.fillRect(cx - 4, ry - 12, W / 2 - PAD - 10, 16)
    }

    // Dot separator
    ctx.fillStyle = '#5a3a12'
    ctx.beginPath(); ctx.arc(cx - 8, ry - 4, 1.5, 0, Math.PI * 2); ctx.fill()

    ctx.textAlign = 'left'
    ctx.fillStyle = '#8a6840'
    ctx.font = '10px Georgia, serif'
    ctx.fillText(label, cx, ry)

    ctx.textAlign = 'right'
    ctx.fillStyle = '#f0e0c0'
    ctx.font = 'bold 10px Georgia, serif'
    ctx.fillText(val, cx === col1x ? W / 2 - 16 : W - PAD - 22, ry)
  })

  // Vertical separator between columns
  const sepX = W / 2
  ctx.strokeStyle = '#3a2408'
  ctx.lineWidth = 0.5
  ctx.beginPath()
  ctx.moveTo(sepX, statsY - 6)
  ctx.lineTo(sepX, statsY + 5 * rowH - 4)
  ctx.stroke()

  // ── Footer ────────────────────────────────────────────────────────────────
  const footerY = H - PAD - 6
  drawFlourishLine(footerY - 12)

  ctx.textAlign = 'left'
  ctx.fillStyle = '#6a4818'
  ctx.font = '8px Georgia, serif'
  ctx.fillText(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }), PAD + 10, footerY)

  ctx.textAlign = 'right'
  ctx.fillStyle = '#7a5820'
  ctx.font = '8px Georgia, serif'
  ctx.fillText('hoangkhoaa.github.io/society-sim', W - PAD - 10, footerY)

  // ── Download ──────────────────────────────────────────────────────────────
  const link = document.createElement('a')
  link.download = `society-sim-${regime}-year${world.year}d${world.day}.png`
  link.href = canvas.toDataURL('image/png')
  link.click()
}

// ── Time controls ──────────────────────────────────────────────────────────

document.getElementById('btn-pause')!.addEventListener('click', function () {
  setPaused(!paused)
})

document.getElementById('btn-speed')!.addEventListener('click', function () {
  const SPEED_STEPS = [1, 3, 12, 24] as const
  const prevSpeed = speed
  const idx = SPEED_STEPS.indexOf(speed as typeof SPEED_STEPS[number])
  speed = SPEED_STEPS[(idx + 1) % SPEED_STEPS.length]
  this.textContent = `${speed}×`

  if (aiConfig && speed > prevSpeed) {
    const rpm = aiConfig.rpm_limit
    if (rpm > 0) {
      // At faster speeds sim-days pass faster → more government + press + science cycles per real minute.
      // At 1×: 1 real sec = 1 sim-hour → 1 sim-day ≈ 24s → ~2.5 days/min
      // At 3×: ~7.5 days/min  At 12×: ~30 days/min  At 24×: ~60 days/min
      const daysPerMin = (speed * 60) / 24
      const govCallsPerMin = daysPerMin / 15
      const pressCallsPerMin = getSettings().enable_press_ai ? daysPerMin / 5 : 0
      // Science fires rarely (~every 60 days on average with probability gating)
      const scienceCallsPerMin = getSettings().enable_science_ai ? daysPerMin / 60 : 0
      const bgPerMin = govCallsPerMin + pressCallsPerMin + scienceCallsPerMin
      const remaining = getRemainingRPM(rpm)
      const estimate = bgPerMin.toFixed(1)

      if (bgPerMin > rpm * 0.5) {
        addFeedRaw(
          `⚠️ Speed ${speed}× will use ~${estimate} AI calls/min for government` +
          (pressCallsPerMin > 0 ? ` + press` : '') +
          (scienceCallsPerMin > 0 ? ` + science` : '') +
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
    world.stats.god_calls++

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

function applySideChannels(response: Awaited<ReturnType<typeof handlePlayerChat>>): void {
  if (!world) return
  if (response.constitution && Object.keys(response.constitution).length) {
    applyConstitutionPatch(world, response.constitution)
    addFeedRaw('📜 Constitution amended.', 'political', world.year, world.day)
  }
  if (response.world_delta) {
    const wd = response.world_delta
    applyWorldDelta(world, wd)
    const parts: string[] = []
    if (wd.food_stock_delta)           parts.push(`food ${wd.food_stock_delta > 0 ? '+' : ''}${Math.round(wd.food_stock_delta)}`)
    if (wd.natural_resources_delta)    parts.push(`resources ${wd.natural_resources_delta > 0 ? '+' : ''}${Math.round(wd.natural_resources_delta)}`)
    if (wd.tax_pool_delta)             parts.push(`treasury ${wd.tax_pool_delta > 0 ? '+' : ''}${Math.round(wd.tax_pool_delta)}`)
    if (wd.quarantine_add?.length)     parts.push(`quarantine added: ${wd.quarantine_add.join(', ')}`)
    if (wd.quarantine_remove?.length)  parts.push(`quarantine lifted: ${wd.quarantine_remove.join(', ')}`)
    if (wd.seed_rumor)                 parts.push(`rumor seeded`)
    if (wd.trigger_referendum) {
      const proposal = wd.trigger_referendum.proposal_text
      addFeedRaw(tf('referendum.triggered', { proposal }) as string, 'political', world.year, world.day)
    }
    if (parts.length) addFeedRaw(`🌍 ${parts.join(' | ')}`, 'info', world.year, world.day)
  }
  if (response.institution_deltas?.length) {
    applyInstitutionDeltas(world, response.institution_deltas)
    const names = response.institution_deltas.map(d => d.id).join(', ')
    addFeedRaw(`🏛 Institutions adjusted: ${names}`, 'political', world.year, world.day)
  }
  if (response.formula_patch?.length) {
    const record = recordFormulaBreakthrough(
      world,
      response.formula_patch,
      'god_agent',
      GOD_AGENT_FORMULA_OVERRIDE_TITLE,
      response.answer ?? 'Simulation formula rewritten by the Architect.',
    )
    if (record) {
      const keys = record.formula_patches?.map(p => p.key).join(', ') ?? ''
      addFeedRaw(`⚗️ Formula rewritten: ${keys}`, 'political', world.year, world.day)
      addBreakthroughToLog(record)
    }
  }
}

function injectEvent(response: Awaited<ReturnType<typeof handlePlayerChat>>) {
  if (!world || !response.event) return
  world.stats.intervention_count++
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

  // Apply side-channel changes (constitution, world_delta, institution_deltas)
  applySideChannels(response)

  // Async consequence prediction (non-blocking)
  void scheduleConsequences(response.event.type ?? 'event', narrative)
}

function executeIntervention(response: Awaited<ReturnType<typeof handlePlayerChat>>) {
  if (!world) return
  world.stats.intervention_count++

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

  // Apply side-channel changes (constitution, world_delta, institution_deltas)
  applySideChannels(response)

  // Async consequence prediction (non-blocking)
  void scheduleConsequences(response.event?.type ?? 'intervention', response.answer)
}

async function scheduleConsequences(eventType: string, narrative: string) {
  if (!world || !aiConfig || !getSettings().enable_consequence_prediction) return
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
        roles: c.intervention.roles as Array<'farmer' | 'craftsman' | 'merchant' | 'scholar' | 'guard' | 'leader' | 'healthcare' | 'gang'> | undefined,
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

document.getElementById('btn-map-note')!.addEventListener('click', () => {
  showInfo(
    t('map.note_title') as string,
    t('map.note_body') as string,
  )
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

// ── Chronicle tab switching (Events / Breakthroughs) ──────────────────────
const chronicleLogEl     = document.getElementById('chronicle-log')
const breakthroughLogEl  = document.getElementById('breakthrough-log')
const chronicleFiltersEl = document.getElementById('chronicle-filters')

document.getElementById('chronicle-tabs')?.addEventListener('click', e => {
  const btn = (e.target as HTMLElement).closest('.chronicle-tab') as HTMLElement | null
  if (!btn) return
  const tab = btn.dataset.tab
  document.querySelectorAll('.chronicle-tab').forEach(b => b.classList.remove('active'))
  btn.classList.add('active')
  if (tab === 'chronicle') {
    if (chronicleLogEl)     chronicleLogEl.style.display = ''
    if (breakthroughLogEl)  breakthroughLogEl.style.display = 'none'
    if (chronicleFiltersEl) chronicleFiltersEl.style.display = ''
  } else {
    if (chronicleLogEl)     chronicleLogEl.style.display = 'none'
    if (breakthroughLogEl)  breakthroughLogEl.style.display = ''
    if (chronicleFiltersEl) chronicleFiltersEl.style.display = 'none'
  }
})

// ── Economics panel tab switching ─────────────────────────────────────────
document.getElementById('econ-tabs')?.addEventListener('click', e => {
  const btn = (e.target as HTMLElement).closest('.econ-tab') as HTMLElement | null
  if (!btn) return
  const tab = btn.dataset.tab
  document.querySelectorAll('.econ-tab').forEach(b => b.classList.remove('active'))
  btn.classList.add('active')
  const dailyPane   = document.getElementById('econ-daily')
  const alltimePane = document.getElementById('econ-alltime')
  if (tab === 'econ-daily') {
    if (dailyPane)   dailyPane.style.display = ''
    if (alltimePane) alltimePane.style.display = 'none'
  } else {
    if (dailyPane)   dailyPane.style.display = 'none'
    if (alltimePane) alltimePane.style.display = ''
  }
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

