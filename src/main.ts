import './css/main.css'
import type { AIConfig, AIProvider, Constitution, WorldState } from './types'
import { setupGreeting, setupChat, applyPreset, handlePlayerChat, resetInGameHistory, predictConsequences } from './ai/god-agent'
import { listAvailableModels, PROVIDER_MODELS, getAIUsage } from './ai/provider'
import { addFeedRaw, addFeedThinking, setFeedFilter, setChronicleFilter } from './ui/feed'
import { showConfirm, showInfo } from './ui/modal'
import { initWorld, tick, spawnEvent, applyInterventions } from './sim/engine'
import { setLang, t, tf } from './i18n'
import { initMap, setMapPaused } from './ui/map'
import type { Lang } from './i18n'

// ── App state ──────────────────────────────────────────────────────────────

let aiConfig: AIConfig | null = null
let world: WorldState | null = null
let noApiKeyMode = false

// ── Language selector ──────────────────────────────────────────────────────

document.querySelectorAll<HTMLButtonElement>('.btn-lang').forEach(btn => {
  btn.addEventListener('click', () => {
    const lang = btn.dataset.lang as Lang
    setLang(lang)
    document.querySelectorAll('.btn-lang').forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
  })
})

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

function syncProviderFields() {
  const provider = providerSelect.value as AIProvider
  const isLocal = provider === 'ollama'
  const isCloud = provider === 'ollama_cloud'
  apiKeyRow.style.display = isLocal ? 'none' : ''
  baseUrlRow.style.display = isCloud ? '' : 'none'
  resetModelSelect()
}

providerSelect.addEventListener('change', syncProviderFields)
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
  const isCloud = provider === 'ollama_cloud'
  const key = apiKeyInput.value.trim()
  const baseUrl = baseUrlInput.value.trim()

  if (!isLocal && !key) {
    showError(t('onboarding.err_no_key') as string)
    return
  }
  if (isCloud && !baseUrl) {
    showError(t('onboarding.err_base_url') as string)
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
  const isCloud = providerSelect.value === 'ollama_cloud'
  const key = apiKeyInput.value.trim()
  const baseUrl = baseUrlInput.value.trim()
  if (!isLocal && !key) {
    showError(t('onboarding.err_no_key') as string)
    return
  }
  if (isCloud && !baseUrl) {
    showError(t('onboarding.err_base_url') as string)
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
  addFeedRaw(t('topbar.init') as string, 'info', 1, 1)

  // Defer initWorld so the feed message renders first
  await new Promise<void>(resolve => setTimeout(resolve, 50))

  world = initWorld(constitution)
  peakPopulation = world.npcs.filter(n => n.lifecycle.is_alive).length

  showScreen('screen-game')
  updateTopbar()

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
}

// ── Topbar ─────────────────────────────────────────────────────────────────

function updateTopbar() {
  if (!world) return
  const { macro, day, year } = world
  const month = Math.ceil(day / 30)

  document.getElementById('clock-label')!.textContent =
    tf('topbar.clock', { y: year, m: month, d: day })

  setStat('v-stability', macro.stability, 'stat-stability', 40, 25)
  setStat('v-food',      macro.food,      'stat-food',      35, 20)
  setStat('v-resources', macro.natural_resources, 'stat-resources', 30, 15)
  setStat('v-energy',    macro.energy,    'stat-energy',    35, 20)
  setStat('v-trust',     macro.trust,     'stat-trust',     35, 20)
  document.getElementById('v-gini')!.textContent = macro.gini.toFixed(2)

  const { requests, tokens } = getAIUsage()
  const tokStr = tokens >= 1000 ? `${(tokens / 1000).toFixed(1)}k` : `${tokens}`
  document.getElementById('ai-usage')!.textContent = `${requests} req · ${tokStr} tok`
}

function setStat(valueId: string, value: number, statId: string, warnAt: number, dangerAt: number) {
  const el     = document.getElementById(valueId)!
  const parent = document.getElementById(statId)!
  el.textContent = `${Math.round(value)}%`
  parent.classList.remove('warn', 'danger')
  if (value <= dangerAt) parent.classList.add('danger')
  else if (value <= warnAt) parent.classList.add('warn')
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
  const living = world.npcs.filter(n => n.lifecycle.is_alive)
  const dead   = world.npcs.length - living.length
  const males  = living.filter(n => n.gender === 'male').length

  document.getElementById('d-pop')!.textContent    = `${living.length}`
  document.getElementById('d-male')!.textContent   = `${males}`
  document.getElementById('d-female')!.textContent = `${living.length - males}`
  document.getElementById('d-deaths')!.textContent = `${dead}`

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

  const total = living.length || 1
  for (const g of AGE_GROUPS) {
    const count = living.filter(n => n.age >= g.min && n.age <= g.max).length
    const pct = Math.round(count / total * 100)
    const fill = container.querySelector<HTMLElement>(`.age-fill[data-age="${g.key}"]`)
    const pctEl = container.querySelector<HTMLElement>(`.age-pct[data-age-pct="${g.key}"]`)
    if (fill) fill.style.width = `${pct}%`
    if (pctEl) pctEl.textContent = `${pct}%`
  }
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
    const affected = applyInterventions(world, [c.intervention])
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

// 1 tick = 1 sim-hour; 42ms interval ≈ 24 ticks/second at 1×
const BASE_TICK_MS = 42

function setPaused(value: boolean) {
  paused = value
  setMapPaused(value)
  btnPause.textContent = paused ? '▶' : '⏸'
}

function startSimLoop() {
  if (simInterval) clearInterval(simInterval)
  simInterval = setInterval(() => {
    if (paused || !world) return
    for (let i = 0; i < speed; i++) tick(world)
    const living = world.npcs.filter(n => n.lifecycle.is_alive).length
    if (living > peakPopulation) peakPopulation = living
    updateTopbar()
    if (world.tick % 24 === 0) {
      updateDemographics()
      flushConsequences()
    }
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
  stats.innerHTML = [
    tf('gameover.stats_pop', { n: peakPopulation }),
    tf('gameover.stats_day', { d: totalDays, ds: totalDays !== 1 ? 's' : '', y: world.year }),
  ].join('<br>')

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
  speed = speed === 1 ? 3 : speed === 3 ? 10 : 1
  this.textContent = `${speed}×`
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
  spawnEvent(world, response.event)

  // Async consequence prediction (non-blocking)
  void scheduleConsequences(response.event.type ?? 'event', narrative)
}

function executeIntervention(response: Awaited<ReturnType<typeof handlePlayerChat>>) {
  if (!world) return

  addFeedRaw(response.answer, 'warning', world.year, world.day)

  if (response.interventions?.length) {
    const affected = applyInterventions(world, response.interventions)
    addFeedRaw(
      tf('engine.intervention', { n: affected, s: '' }) as string,
      'critical', world.year, world.day,
    )
  }

  // Companion event (e.g., radiation epidemic after nuclear bomb)
  if (response.event) {
    const narrative = response.event.narrative_open ?? ''
    addFeedRaw(narrative, 'warning', world!.year, world!.day)
    spawnEvent(world, response.event)
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

