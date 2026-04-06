import './css/main.css'
import type { AIConfig, Constitution, WorldState } from './types'
import { setupGreeting, setupChat, applyPreset, handlePlayerChat } from './ai/god-agent'
import { addFeedRaw, addFeedThinking } from './ui/feed'
import { showConfirm } from './ui/modal'
import { initWorld, tick, spawnEvent, applyInterventions } from './sim/engine'
import { setLang, t, tf } from './i18n'
import { initMap } from './ui/map'
import type { Lang } from './i18n'

// ── App state ──────────────────────────────────────────────────────────────

let aiConfig: AIConfig | null = null
let world: WorldState | null = null

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
const apiKeyInput    = document.getElementById('api-key-input') as HTMLInputElement
const providerSelect = document.getElementById('provider-select') as HTMLSelectElement
const onboardingErr  = document.getElementById('onboarding-error')!

btnStart.addEventListener('click', async () => {
  const key = apiKeyInput.value.trim()
  if (!key) {
    showError(t('onboarding.err_no_key') as string)
    return
  }

  aiConfig = {
    provider: providerSelect.value as AIConfig['provider'],
    key,
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

function showError(msg: string) {
  onboardingErr.textContent = msg
  onboardingErr.classList.remove('hidden')
}

// ── Setup conversation ─────────────────────────────────────────────────────

const setupMessages = document.getElementById('setup-messages')!
const setupInput    = document.getElementById('setup-input') as HTMLInputElement
const btnSetupSend  = document.getElementById('btn-setup-send')!

async function startSetupConversation() {
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
    const preset = (btn as HTMLElement).dataset.preset as 'nordic' | 'capitalist' | 'socialist'
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

  addFeedRaw(`${t('topbar.initialized')} ${desc}`, 'player', 1, 1)
  addFeedRaw(
    tf('topbar.constitution_set', {
      n: world.npcs.length,
      g: constitution.gini_start.toFixed(2),
      p: Math.round(constitution.state_power * 100),
    }),
    'info', 1, 1,
  )

  startSimLoop()
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
  setStat('v-trust',     macro.trust,     'stat-trust',     35, 20)
  document.getElementById('v-gini')!.textContent = macro.gini.toFixed(2)
}

function setStat(valueId: string, value: number, statId: string, warnAt: number, dangerAt: number) {
  const el     = document.getElementById(valueId)!
  const parent = document.getElementById(statId)!
  el.textContent = `${Math.round(value)}%`
  parent.classList.remove('warn', 'danger')
  if (value <= dangerAt) parent.classList.add('danger')
  else if (value <= warnAt) parent.classList.add('warn')
}

// ── Simulation loop ────────────────────────────────────────────────────────

let paused = false
let speed = 1
let simInterval: ReturnType<typeof setInterval> | null = null
let peakPopulation = 0

// 1 tick = 1 sim-hour; 42ms interval ≈ 24 ticks/second at 1×
const BASE_TICK_MS = 42

function startSimLoop() {
  if (simInterval) clearInterval(simInterval)
  simInterval = setInterval(() => {
    if (paused || !world) return
    for (let i = 0; i < speed; i++) tick(world)
    const living = world.npcs.filter(n => n.lifecycle.is_alive).length
    if (living > peakPopulation) peakPopulation = living
    updateTopbar()
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
  peakPopulation = 0
  world = null
  showScreen('screen-onboarding')
  // Reset the start button in case it was disabled
  const btnStart = document.getElementById('btn-start')!
  btnStart.textContent = t('onboarding.btn_start') as string
  btnStart.removeAttribute('disabled')
})

// ── Time controls ──────────────────────────────────────────────────────────

document.getElementById('btn-pause')!.addEventListener('click', function () {
  paused = !paused
  this.textContent = paused ? '▶' : '⏸'
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

  addFeedRaw(`🌐 "${msg}"`, 'player', world.year, world.day)

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
  }
}

function injectEvent(response: Awaited<ReturnType<typeof handlePlayerChat>>) {
  if (!world || !response.event) return
  addFeedRaw(
    `${response.event.narrative_open ?? response.answer}`,
    'player', world.year, world.day,
  )
  spawnEvent(world, response.event)
}

function executeIntervention(response: Awaited<ReturnType<typeof handlePlayerChat>>) {
  if (!world) return

  addFeedRaw(response.answer, 'player', world.year, world.day)

  if (response.interventions?.length) {
    const affected = applyInterventions(world, response.interventions)
    addFeedRaw(
      tf('engine.intervention', { n: affected, s: '' }) as string,
      'critical', world.year, world.day,
    )
  }

  // Companion event (e.g., radiation epidemic after nuclear bomb)
  if (response.event) {
    addFeedRaw(
      `${response.event.narrative_open ?? ''}`,
      'player', world.year, world.day,
    )
    spawnEvent(world, response.event)
  }
}

btnChatSend.addEventListener('click', sendChatMessage)
chatInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') sendChatMessage()
})

