import type { NPC, WorldState, AIConfig, NPCChatTurn, Role } from '../types'
import { generateNPCThought } from '../ai/god-agent'
import { handleNPCChat } from '../ai/npc-agent'
import { callAI } from '../ai/provider'
import { t, tf, getLang } from '../i18n'
import { getSettings } from './settings-panel'
import { clamp } from '../sim/constitution'
import { permanentRoleChange } from '../sim/npc'
import {
  spLifeStoryTitle,
  spLegendary,
  spFaction,
  spMarried,
  spCompatibility,
  spInLove,
  spHeartbroken,
  spChildren,
  spCriminalRecord,
  spDebt,
  spMemLoss,
  spMemWindfall,
  spMemHelped,
  spMemTrustBroken,
  spMemCrisis,
  spWealthy,
  spPoor,
  spCapitalLabel,
  spRentsFromLabel,
  spNoneLabel,
} from '../local/ui'

const panel   = document.getElementById('spotlight')!
const spName  = document.getElementById('sp-name')!
const spBody  = document.getElementById('sp-body')!
const spClose = document.getElementById('sp-close')!
const sidePanel = document.getElementById('spotlight-side')!
const sideTitle = document.getElementById('sp-side-title')!
const sideBody  = document.getElementById('sp-side-body')!
const sideClose = document.getElementById('sp-side-close')!

spClose.addEventListener('click', () => close())
sideClose?.addEventListener('click', () => closeSubPanel())

export function close() {
  closeSubPanel()
  panel.classList.add('hidden')
}

// ── Pause/resume callbacks (set by main.ts to avoid circular dep) ──────────
let _onOpen:    (() => void) | null = null
let _onClose:   (() => void) | null = null
let _onNpcChat: (() => void) | null = null
let _onNpcEdit: (() => void) | null = null

export function registerSpotlightCallbacks(
  onOpen:    () => void,
  onClose:   () => void,
  onNpcChat: () => void,
  onNpcEdit: () => void,
): void {
  _onOpen    = onOpen
  _onClose   = onClose
  _onNpcChat = onNpcChat
  _onNpcEdit = onNpcEdit
}

function openSubPanel(title: string, bodyHtml: string): void {
  if (sidePanel.classList.contains('hidden')) _onOpen?.()
  sideTitle.textContent = title
  sideBody.innerHTML = bodyHtml
  sidePanel.classList.remove('hidden')
}

function closeSubPanel(): void {
  const wasOpen = !sidePanel.classList.contains('hidden')
  sidePanel.classList.add('hidden')
  sideBody.innerHTML = ''

  // If the chat panel was open, generate a persistent summary after 3+ turns
  if (_chatPanelOpen && _chatNpc) {
    _chatPanelOpen = false
    const npc = _chatNpc
    const turns = npcChatHistories.get(npc.id) ?? []
    if (turns.length >= MIN_TURNS_FOR_SUMMARY) {
      buildChatSummary(npc, turns, _chatConfig, _useAI).then(summary => {
        if (summary) npc.chat_summary = summary
      }).catch(err => { console.warn('Chat summary generation failed:', err) })
    }
  }

  if (wasOpen) _onClose?.()
}

// ── NPC conversation state ─────────────────────────────────────────────────
const npcChatHistories = new Map<number, NPCChatTurn[]>()
let _chatNpc:    NPC | null = null
let _chatState:  WorldState | null = null
let _chatConfig: AIConfig | null = null
let _useAI = true   // player-controlled AI toggle (persists across NPCs)
let _chatPanelOpen = false  // true while the chat sub-panel is visible

export function resetNPCChatHistories(): void {
  npcChatHistories.clear()
}

// ── Chat summary generation ────────────────────────────────────────────────

const MAX_SUMMARY_LENGTH  = 300
const MIN_TURNS_FOR_SUMMARY = 3

/** Build a compact summary of the conversation to persist in npc.chat_summary. */
async function buildChatSummary(
  npc: NPC,
  turns: NPCChatTurn[],
  config: AIConfig | null,
  useAI: boolean,
): Promise<string> {
  if (useAI && config) {
    try {
      const dialog = turns.map(turn =>
        turn.speaker === 'player' ? `Stranger: "${turn.text}"` : `${npc.name}: "${turn.text}"`
      ).join('\n')
      const prompt = `Summarize this conversation in 1–2 sentences (max ${MAX_SUMMARY_LENGTH} chars), third-person, capturing key topics and emotional tone:\n${dialog}`
      const raw = await callAI(config, 'You are a concise summarizer. Return plain text only, no JSON.', prompt, 80)
      return raw.trim().slice(0, MAX_SUMMARY_LENGTH)
    } catch (err) {
      console.warn('Chat summary AI failed, using fallback:', err)
    }
  }

  // No-AI fallback: join the last 2 NPC turns
  const npcTurns = turns.filter(t => t.speaker === 'npc').slice(-2)
  return npcTurns.map(t => t.text).join(' ').slice(0, MAX_SUMMARY_LENGTH)
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderNPCChatThread(history: NPCChatTurn[], npcName: string, root: ParentNode = document): void {
  const thread = root.querySelector('#sp-chat-thread')
  if (!thread) return
  if (history.length === 0) {
    thread.innerHTML = `<div class="sp-chat-empty">${t('sp.chat.empty') as string}</div>`
  } else {
    thread.innerHTML = history.map(turn =>
      turn.speaker === 'player'
        ? `<div class="sp-chat-bubble sp-chat-player">${escapeHtml(turn.text)}</div>`
        : `<div class="sp-chat-bubble sp-chat-npc"><b>${escapeHtml(npcName)}:</b> ${escapeHtml(turn.text)}</div>`
    ).join('')
  }
  thread.scrollTop = thread.scrollHeight
}

function getFallbackResponse(npc: NPC): string {
  if (npc.fear > 70)      return t('sp.chat.fallback.fear') as string
  if (npc.grievance > 75) return t('sp.chat.fallback.grievance') as string
  if (npc.stress > 70)    return t('sp.chat.fallback.stress') as string
  if (npc.happiness > 65) return t('sp.chat.fallback.happy') as string
  return t('sp.chat.fallback.neutral') as string
}

/** Sync a range + number pair and call onChange with the new value. */
function wireSlider(root: ParentNode, id: string, onChange: (v: number) => void): void {
  const range  = root.querySelector(`#sp-edit-${id}-range`) as HTMLInputElement | null
  const num    = root.querySelector(`#sp-edit-${id}-num`)   as HTMLInputElement | null
  if (!range || !num) return

  range.addEventListener('input', () => {
    num.value = range.value
    onChange(parseFloat(range.value))
  })
  num.addEventListener('change', () => {
    const v = Math.min(parseFloat(num.max), Math.max(parseFloat(num.min), parseFloat(num.value) || 0))
    num.value   = String(v)
    range.value = String(v)
    onChange(v)
  })
}

function wireStatsEditor(npc: NPC, state: WorldState, root: ParentNode): void {
  // Collapsible toggle
  const toggle = root.querySelector('#sp-edit-toggle')
  const body   = root.querySelector('#sp-edit-body') as HTMLElement | null
  const chevron = toggle?.querySelector('.sp-edit-chevron') as HTMLElement | null
  toggle?.addEventListener('click', () => {
    const open = body?.style.display === 'none'
    if (body) body.style.display = open ? '' : 'none'
    if (chevron) chevron.textContent = open ? '▼' : '▶'
  })

  // Emotional stats (0–100)
  wireSlider(root, 'stress',     v => { npc.stress     = clamp(v, 0, 100) })
  wireSlider(root, 'happiness',  v => { npc.happiness  = clamp(v, 0, 100) })
  wireSlider(root, 'grievance',  v => { npc.grievance  = clamp(v, 0, 100) })
  wireSlider(root, 'fear',       v => { npc.fear       = clamp(v, 0, 100) })
  wireSlider(root, 'hunger',     v => { npc.hunger     = clamp(v, 0, 100) })
  wireSlider(root, 'exhaustion', v => { npc.exhaustion = clamp(v, 0, 100) })
  wireSlider(root, 'isolation',  v => { npc.isolation  = clamp(v, 0, 100) })
  wireSlider(root, 'solidarity', v => {
    npc.class_solidarity = clamp(v, 0, 100)
    if (npc.class_solidarity < 45 && npc.on_strike) npc.on_strike = false
  })

  // Worldview (0–100 → 0–1)
  wireSlider(root, 'wv-collectivism', v => { npc.worldview.collectivism    = clamp(v / 100, 0, 1) })
  wireSlider(root, 'wv-authority',    v => { npc.worldview.authority_trust = clamp(v / 100, 0, 1) })
  wireSlider(root, 'wv-risk',         v => { npc.worldview.risk_tolerance  = clamp(v / 100, 0, 1) })
  wireSlider(root, 'wv-time',         v => { npc.worldview.time_preference = clamp(v / 100, 0, 1) })

  // Economy
  wireSlider(root, 'wealth',  v => { npc.wealth          = Math.max(0, v) })
  wireSlider(root, 'capital', v => { npc.capital         = clamp(v, 0, 100) })

  // Flags
  const sickCb    = root.querySelector('#sp-edit-sick')            as HTMLInputElement | null
  const strikeCb  = root.querySelector('#sp-edit-on-strike')       as HTMLInputElement | null
  const crimeCb   = root.querySelector('#sp-edit-criminal-record') as HTMLInputElement | null

  sickCb?.addEventListener('change',   () => {
    npc.sick = sickCb.checked
    if (npc.sick && npc.sick_ticks < 48) npc.sick_ticks = 48
  })
  strikeCb?.addEventListener('change', () => { npc.on_strike       = strikeCb.checked })
  crimeCb?.addEventListener('change',  () => { npc.criminal_record = crimeCb.checked })

  // Work motivation
  const motSel = root.querySelector('#sp-edit-work-motivation') as HTMLSelectElement | null
  motSel?.addEventListener('change', () => {
    npc.work_motivation = motSel.value as NPC['work_motivation']
  })

  // Role (permanent career change)
  const roleSel = root.querySelector('#sp-edit-role') as HTMLSelectElement | null
  roleSel?.addEventListener('change', () => {
    const newRole = roleSel.value as Role
    if (newRole !== npc.role) {
      permanentRoleChange(npc, newRole, state)
    }
  })
}

function renderChatPanel(npc: NPC): string {
  const memorySectionHtml = npc.chat_summary
    ? `<div class="sp-chat-memory">
        <div class="sp-chat-memory-title">${t('sp.chat.memory_title') as string}</div>
        <div class="sp-chat-memory-body">${t('sp.chat.memory_label') as string} ${escapeHtml(npc.chat_summary)}</div>
       </div>`
    : ''
  return `
    <div class="sp-chat-section" data-npc="${npc.id}">
      ${memorySectionHtml}
      <div class="sp-chat-thread" id="sp-chat-thread"></div>
      <div class="sp-chat-input-row">
        <button id="sp-chat-ai-toggle" class="btn-icon sp-chat-ai-btn" title="${t('sp.chat.ai_toggle') as string}">🤖</button>
        <input type="text" id="sp-chat-input" class="sp-chat-input" placeholder="${t('sp.chat.input_ph') as string}" maxlength="200" />
        <button id="sp-chat-send" class="btn-icon sp-chat-send-btn">→</button>
      </div>
    </div>
  `
}

function renderEditPanel(npc: NPC): string {
  return `
    <div class="sp-section sp-edit-section">
      <div class="sp-section-title sp-edit-toggle" id="sp-edit-toggle">
        ✏️ Edit Stats <span class="sp-edit-chevron">▼</span>
      </div>
      <div class="sp-edit-body" id="sp-edit-body">
        <div class="sp-edit-group-title">Emotional (0–100)</div>
        ${editSlider('stress',      'Stress',      Math.round(npc.stress),      0, 100)}
        ${editSlider('happiness',   'Happiness',   Math.round(npc.happiness),   0, 100)}
        ${editSlider('grievance',   'Grievance',   Math.round(npc.grievance),   0, 100)}
        ${editSlider('fear',        'Fear',        Math.round(npc.fear),        0, 100)}
        ${editSlider('hunger',      'Hunger',      Math.round(npc.hunger),      0, 100)}
        ${editSlider('exhaustion',  'Exhaustion',  Math.round(npc.exhaustion),  0, 100)}
        ${editSlider('isolation',   'Isolation',   Math.round(npc.isolation ?? 0), 0, 100)}
        ${editSlider('solidarity',  'Class Solidarity', Math.round(npc.class_solidarity ?? 0), 0, 100)}
        <div class="sp-edit-group-title">Worldview (0–100%)</div>
        ${editSlider('wv-collectivism',    'Collectivism',    Math.round(npc.worldview.collectivism    * 100), 0, 100)}
        ${editSlider('wv-authority',       'Authority trust', Math.round(npc.worldview.authority_trust * 100), 0, 100)}
        ${editSlider('wv-risk',            'Risk tolerance',  Math.round(npc.worldview.risk_tolerance  * 100), 0, 100)}
        ${editSlider('wv-time',            'Time preference', Math.round(npc.worldview.time_preference * 100), 0, 100)}
        <div class="sp-edit-group-title">Economy</div>
        ${editSlider('wealth',   'Wealth (coins)', Math.round(npc.wealth), 0, 99999, 50)}
        ${editSlider('capital',  'Capital (0–100)', Math.round(npc.capital ?? 0), 0, 100)}
        <div class="sp-edit-group-title">Flags</div>
        <div class="sp-edit-flags">
          ${editCheckbox('sick',            'Sick',            npc.sick ?? false)}
          ${editCheckbox('on-strike',       'On Strike',       npc.on_strike ?? false)}
          ${editCheckbox('criminal-record', 'Criminal Record', npc.criminal_record ?? false)}
        </div>
        <div class="sp-edit-group-title">Work Motivation</div>
        <div class="sp-edit-row">
          <select id="sp-edit-work-motivation" class="sp-edit-select">
            ${(['survival','coerced','mandatory','happiness','achievement','duty'] as const).map(v =>
              `<option value="${v}"${npc.work_motivation === v ? ' selected' : ''}>${v}</option>`
            ).join('')}
          </select>
        </div>
        <div class="sp-edit-group-title">Role</div>
        <div class="sp-edit-row">
          <select id="sp-edit-role" class="sp-edit-select">
            ${(['farmer','craftsman','merchant','scholar','guard','leader'] as Role[]).map(r =>
              `<option value="${r}"${npc.role === r ? ' selected' : ''}>${r}</option>`
            ).join('')}
          </select>
        </div>
      </div>
    </div>
  `
}

export async function openSpotlight(npc: NPC, state: WorldState, config: AIConfig | null) {
  closeSubPanel()
  panel.classList.remove('hidden')
  spName.textContent = `${npc.name} · ${npc.occupation}`

  // Save refs for NPC chat
  _chatNpc    = npc
  _chatState  = state
  _chatConfig = config

  // Render static info immediately, then load the daily thought async
  spBody.innerHTML = renderStatic(npc, state)
  drawPixelCharacter(npc)

  const openChatBtn = spBody.querySelector('#sp-open-chat') as HTMLButtonElement | null
  const openEditBtn = spBody.querySelector('#sp-open-edit') as HTMLButtonElement | null

  // Wire NPC name links (spouse / romance target → open their spotlight)
  spBody.querySelectorAll<HTMLButtonElement>('[data-npc-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.npcId ?? '', 10)
      const linked = state.npcs.find(n => n.id === id)
      if (linked) openSpotlight(linked, state, config)
    })
  })

  openEditBtn?.addEventListener('click', () => {
    _chatPanelOpen = false
    openSubPanel(tf('sp.edit.title', { name: npc.name }), renderEditPanel(npc))
    wireStatsEditor(npc, state, sideBody)
    _onNpcEdit?.()
  })

  openChatBtn?.addEventListener('click', () => {
    _chatPanelOpen = true
    openSubPanel(tf('sp.chat.panel_title', { name: npc.name }), renderChatPanel(npc))
    const history = npcChatHistories.get(npc.id) ?? []
    renderNPCChatThread(history, npc.name, sideBody)

    const chatInput  = sideBody.querySelector('#sp-chat-input') as HTMLInputElement | null
    const chatSend   = sideBody.querySelector('#sp-chat-send')  as HTMLButtonElement | null
    const chatThread = sideBody.querySelector('#sp-chat-thread') as HTMLElement | null
    const aiToggle = sideBody.querySelector('#sp-chat-ai-toggle') as HTMLButtonElement | null

    const updateAIToggle = () => {
      if (!aiToggle) return
      aiToggle.textContent = _useAI ? '🤖 AI' : '💬 AI'
      aiToggle.title = _useAI
        ? t('sp.chat.ai_on_title') as string
        : t('sp.chat.ai_off_title') as string
      aiToggle.classList.toggle('sp-chat-ai-off', !_useAI)
    }
    updateAIToggle()
    aiToggle?.addEventListener('click', () => {
      _useAI = !_useAI
      updateAIToggle()
    })

    if (chatInput && chatSend && chatThread) {
      const doSend = async () => {
        const msg = chatInput.value.trim()
        if (!msg || !_chatNpc || !_chatState) return
        chatInput.value = ''
        chatSend.disabled = true
        chatInput.disabled = true
        _onNpcChat?.()

        const turns = npcChatHistories.get(_chatNpc.id) ?? []
        turns.push({ speaker: 'player', text: msg })
        renderNPCChatThread(turns, _chatNpc.name, sideBody)

        // Thinking bubble
        const thinkEl = document.createElement('div')
        thinkEl.className = 'sp-chat-bubble sp-chat-npc sp-chat-thinking'
        thinkEl.innerHTML = `<b>${escapeHtml(_chatNpc.name)}:</b> <em>...</em>`
        chatThread.appendChild(thinkEl)
        chatThread.scrollTop = chatThread.scrollHeight

        // If NPC is sleeping, respond without AI
        if (_chatNpc.action_state === 'resting') {
          const sleepResponses = [
            tf('sp.chat.sleeping_1', { name: _chatNpc.name }),
            tf('sp.chat.sleeping_2', { name: _chatNpc.name }),
            t('sp.chat.sleeping_3') as string,
            t('sp.chat.sleeping_4') as string,
          ]
          const replyText = sleepResponses[Math.floor(Math.random() * sleepResponses.length)]
          turns.push({ speaker: 'npc', text: replyText })
          npcChatHistories.set(_chatNpc.id, turns.slice(-20))
          thinkEl.remove()
          renderNPCChatThread(turns, _chatNpc.name, sideBody)
          chatSend.disabled  = false
          chatInput.disabled = false
          chatInput.focus()
          return
        }

        let replyText: string
        if (_useAI && _chatConfig) {
          try {
            const result = await handleNPCChat(_chatNpc, msg, turns, _chatState, _chatConfig)
            replyText = result.text

            // Apply conversational stat effects
            const e = result.effect
            if (e) {
              if (e.grievance_delta != null) _chatNpc.grievance  = clamp(_chatNpc.grievance  + e.grievance_delta,  0, 100)
              if (e.fear_delta != null)      _chatNpc.fear       = clamp(_chatNpc.fear       + e.fear_delta,       0, 100)
              if (e.happiness_delta != null) _chatNpc.happiness  = clamp(_chatNpc.happiness  + e.happiness_delta,  0, 100)
              if (e.trust_delta != null) {
                const gov = _chatNpc.trust_in['government']
                if (gov) gov.intention = clamp(gov.intention + e.trust_delta, 0, 1)
              }
            }
          } catch {
            replyText = getFallbackResponse(_chatNpc)
          }
        } else {
          replyText = getFallbackResponse(_chatNpc)
        }

        turns.push({ speaker: 'npc', text: replyText })
        npcChatHistories.set(_chatNpc.id, turns.slice(-20))

        thinkEl.remove()
        renderNPCChatThread(turns, _chatNpc.name, sideBody)
        chatSend.disabled  = false
        chatInput.disabled = false
        chatInput.focus()
      }

      chatSend.addEventListener('click', doSend)
      chatInput.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.isComposing) doSend()
      })
    }
  })

  // Async: daily thought
  const thoughtEl = document.getElementById('sp-thought-text')!
  thoughtEl.textContent = t('sp.thought_loading') as string
  thoughtEl.className   = 'sp-thought loading'

  if (!config || !getSettings().enable_npc_thoughts) {
    thoughtEl.textContent = t('sp.thought_fail') as string
    thoughtEl.className = 'sp-thought'
    return
  }

  try {
    const thought = await generateNPCThought(npc, state, config)
    thoughtEl.textContent = `"${thought}"`
    thoughtEl.className   = 'sp-thought'
  } catch (e) {
    thoughtEl.textContent = t('sp.thought_fail') as string
    thoughtEl.className   = 'sp-thought'
    console.error('Thought generation failed:', e)
  }
}

function editSlider(id: string, label: string, value: number, min: number, max: number, step = 1): string {
  return `
    <div class="sp-edit-row">
      <span class="sp-edit-label">${label}</span>
      <input type="range"  id="sp-edit-${id}-range" class="sp-edit-range" min="${min}" max="${max}" step="${step}" value="${value}">
      <input type="number" id="sp-edit-${id}-num"   class="sp-edit-num"   min="${min}" max="${max}" step="${step}" value="${value}">
    </div>`
}

function editCheckbox(id: string, label: string, checked: boolean): string {
  return `
    <label class="sp-edit-check-label">
      <input type="checkbox" id="sp-edit-${id}" ${checked ? 'checked' : ''}> ${label}
    </label>`
}

function lifeStory(npc: NPC, state: WorldState): string {
  if (npc.age < 20) return ''
  const lang = getLang()
  const lines: string[] = []

  if (npc.legendary) {
    lines.push(spLegendary(lang, npc.name))
  }
  if (npc.faction_id !== null) {
    const faction = state.factions.find(f => f.id === npc.faction_id)
    if (faction) lines.push(spFaction(lang, faction.name, faction.dominant_value))
  }
  if (npc.lifecycle.spouse_id !== null) {
    const spouse = state.npcs.find(n => n.id === npc.lifecycle.spouse_id)
    if (spouse) {
      lines.push(spMarried(lang, spouse.name, spouse.occupation.toLowerCase()))

      // Compatibility with spouse
      const compat = Math.round(coupleCompatibilityPublic(npc, spouse) * 100)
      lines.push(spCompatibility(lang, compat))
    }
  } else if (npc.lifecycle.romance_target_id !== null) {
    const target = state.npcs.find(n => n.id === npc.lifecycle.romance_target_id)
    if (target) lines.push(spInLove(lang, target.name, Math.round(npc.lifecycle.romance_score ?? 0)))
  } else if ((npc.lifecycle.heartbreak_cooldown ?? 0) > 0) {
    const days = Math.ceil((npc.lifecycle.heartbreak_cooldown ?? 0) / 24)
    lines.push(spHeartbroken(lang, days))
  }
  if (npc.lifecycle.children_ids.length > 0) {
    lines.push(spChildren(lang, npc.lifecycle.children_ids.length))
  }
  if (npc.criminal_record) lines.push(spCriminalRecord(lang))
  if (npc.debt > 0) {
    const creditor = state.npcs.find(n => n.id === npc.debt_to)
    lines.push(spDebt(lang, npc.debt.toFixed(0), creditor?.name ?? null))
  }
  // Notable memories
  const heavy = npc.memory.filter(m => Math.abs(m.emotional_weight) > 30).slice(0, 2)
  for (const mem of heavy) {
    if      (mem.type === 'loss')         lines.push(spMemLoss(lang))
    else if (mem.type === 'windfall')     lines.push(spMemWindfall(lang))
    else if (mem.type === 'helped')       lines.push(spMemHelped(lang))
    else if (mem.type === 'trust_broken') lines.push(spMemTrustBroken(lang))
    else if (mem.type === 'crisis')       lines.push(spMemCrisis(lang))
  }
  if (npc.wealth > 5000)                    lines.push(spWealthy(lang, npc.wealth.toFixed(0)))
  else if (npc.wealth < 50 && npc.age > 30) lines.push(spPoor(lang))

  if (lines.length === 0) return ''
  return `
    <div class="sp-section">
      <div class="sp-section-title">${spLifeStoryTitle(lang)}</div>
      <div class="sp-description" style="line-height:1.6">
        ${lines.map(l => `<div style="margin-bottom:4px">${l}</div>`).join('')}
      </div>
    </div>`
}

// ── Pixel character renderer ───────────────────────────────────────────────

const PIXEL_SKIN: Record<string, string> = {
  light: '#f5d5a8', medium: '#c8914f', dark: '#7a4828',
}
const PIXEL_HAIR: Record<string, string> = {
  black: '#1c1c1c', brown: '#6b3d2a', gray: '#888888', white: '#e0e0e0',
}
const PIXEL_CLOTH: Record<string, string> = {
  farmer: '#5d7a3e', craftsman: '#8a6040', scholar: '#4060a0',
  merchant: '#a08020', guard: '#405070', leader: '#802020', child: '#8050a0',
}
const PIXEL_STATE_EMOJI: Record<string, string> = {
  working: '⚒️', resting: '😴', socializing: '💬', family: '🏠',
  organizing: '✊', fleeing: '🏃', complying: '🫡', confront: '⚠️',
}

function renderPixelCharacterSection(): string {
  return `
    <div class="sp-section sp-pixel-section">
      <div class="sp-pixel-wrap">
        <canvas id="sp-pixel-char" class="sp-pixel-canvas"></canvas>
        <div id="sp-pixel-state" class="sp-pixel-state"></div>
      </div>
    </div>`
}

function drawPixelCharacter(npc: NPC): void {
  const canvas = document.getElementById('sp-pixel-char') as HTMLCanvasElement | null
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const skin  = PIXEL_SKIN[npc.appearance.skin]   ?? '#c8914f'
  const hair  = PIXEL_HAIR[npc.appearance.hair]   ?? '#6b3d2a'
  const cloth = PIXEL_CLOTH[npc.role]              ?? '#555555'
  const eye   = '#2a2a4a'
  const leg   = '#303040'
  const shoe  = '#1a1010'
  const ps    = 4    // pixels per grid cell
  const W     = 10   // grid columns

  // Leg rows vary by height
  const legRows = npc.appearance.height === 'short' ? 2
    : npc.appearance.height === 'tall'  ? 4 : 3
  // Total: hair(2) + face(3) + collar(1) + torso(5) + legs + feet(1) = 12 + legRows
  const totalRows = 12 + legRows

  canvas.width  = W * ps
  canvas.height = totalRows * ps
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  const px = (x: number, y: number, color: string) => {
    ctx.fillStyle = color
    ctx.fillRect(x * ps, y * ps, ps, ps)
  }

  const isFemale = npc.gender === 'female'

  // --- Hair (rows 0–1) ---
  for (let x = 3; x <= 6; x++) px(x, 0, hair)
  for (let x = 2; x <= 7; x++) px(x, 1, hair)
  // Female: longer side hair
  if (isFemale) {
    px(2, 2, hair); px(7, 2, hair)
    px(2, 3, hair); px(7, 3, hair)
    px(2, 4, hair); px(7, 4, hair)
  }

  // --- Face (rows 2–4): skin ---
  for (let y = 2; y <= 4; y++) {
    for (let x = 2; x <= 7; x++) px(x, y, skin)
  }
  // Eyes (row 3)
  px(3, 3, eye); px(6, 3, eye)
  // Mouth (row 4)
  px(4, 4, '#c07070'); px(5, 4, '#c07070')
  // Female: restore side hair over face
  if (isFemale) {
    px(2, 3, hair); px(7, 3, hair)
    px(2, 4, hair); px(7, 4, hair)
  }

  // --- Collar / neck (row 5) ---
  for (let x = 3; x <= 6; x++) px(x, 5, cloth)
  px(4, 5, skin); px(5, 5, skin)

  // --- Body build params ---
  let b1: number, b2: number, a1: number, a2: number
  if (npc.appearance.build === 'slim') {
    b1 = 3; b2 = 6; a1 = 2; a2 = 7
  } else if (npc.appearance.build === 'sturdy') {
    b1 = 2; b2 = 7; a1 = 1; a2 = 8
  } else {
    // average
    b1 = 3; b2 = 6; a1 = 1; a2 = 8
  }

  // --- Arms + torso (rows 6–10) ---
  for (let y = 6; y <= 10; y++) {
    for (let x = b1; x <= b2; x++) px(x, y, cloth)
    if (y <= 8) {
      px(a1, y, cloth)
      px(a2, y, cloth)
    }
  }

  // --- Legs (rows 11 to 11+legRows-1) ---
  const legStart = 11
  for (let y = legStart; y < legStart + legRows; y++) {
    px(3, y, leg); px(4, y, leg)   // left leg
    px(5, y, leg); px(6, y, leg)   // right leg
  }

  // --- Feet (last row) ---
  const feetRow = legStart + legRows
  px(2, feetRow, shoe); px(3, feetRow, shoe); px(4, feetRow, shoe)
  px(5, feetRow, shoe); px(6, feetRow, shoe); px(7, feetRow, shoe)

  // --- Sick tint overlay ---
  if (npc.sick) {
    ctx.globalAlpha = 0.25
    ctx.fillStyle   = '#44cc44'
    ctx.fillRect(2 * ps, 2 * ps, 6 * ps, 3 * ps)
    ctx.globalAlpha = 1.0
  }

  // --- Action state emoji ---
  const stateEl = document.getElementById('sp-pixel-state')
  if (stateEl) {
    stateEl.textContent = PIXEL_STATE_EMOJI[npc.action_state] ?? ''
  }
}

function renderStatic(npc: NPC, state: WorldState): string {
  const trustGov        = npc.trust_in.government
  const compositeTrust  = Math.round((trustGov.competence + trustGov.intention) / 2 * 100)
  const alive = npc.lifecycle.is_alive

  // Marital / romance status label
  let marital: string
  if (npc.lifecycle.spouse_id !== null) {
    const spouse = state.npcs.find(n => n.id === npc.lifecycle.spouse_id)
    marital = spouse
      ? `${t('sp.married')} <button class="sp-npc-link" data-npc-id="${spouse.id}">${escapeHtml(spouse.name)}</button>`
      : t('sp.married') as string
  } else if (npc.lifecycle.romance_target_id !== null) {
    const target = state.npcs.find(n => n.id === npc.lifecycle.romance_target_id)
    marital = target
      ? `${t('sp.in_love')} <button class="sp-npc-link" data-npc-id="${target.id}">${escapeHtml(target.name)}</button>`
      : t('sp.single') as string
  } else if ((npc.lifecycle.heartbreak_cooldown ?? 0) > 0) {
    marital = t('sp.heartbroken') as string
  } else {
    marital = t('sp.single') as string
  }

  const genderLabel = npc.gender === 'male' ? t('sp.male') : t('sp.female')

  // Appearance tags using i18n labels
  const heightLabel = t(`app.${npc.appearance.height}`) as string
  const buildLabel  = npc.appearance.build === 'average'
    ? t('app.average_build') as string : t(`app.${npc.appearance.build}`) as string
  const hairLabel   = t(`hair.${npc.appearance.hair}`) as string
  const skinLabel   = t(`skin.${npc.appearance.skin}`) as string

  // Personality trait pills derived from worldview + economic situation + network
  type TraitPill = { label: string; color: string }
  const traitPills: TraitPill[] = []
  const wv = npc.worldview
  const ROLE_EXPECT: Record<string, number> = {
    farmer: 300, craftsman: 400, merchant: 600, scholar: 350,
    guard: 350, leader: 700, child: 50,
  }
  const wealthExpect = ROLE_EXPECT[npc.role] ?? 400

  if (wv.collectivism > 0.65)       traitPills.push({ label: t('trait.collectivist')  as string, color: '#7f77dd' })
  else if (wv.collectivism < 0.35)  traitPills.push({ label: t('trait.individualist') as string, color: '#c0a0ff' })
  if (wv.authority_trust > 0.65)    traitPills.push({ label: t('trait.authoritarian') as string, color: '#ef9f27' })
  else if (wv.authority_trust < 0.30) traitPills.push({ label: t('trait.rebel')       as string, color: '#e24b4b' })
  if (wv.risk_tolerance > 0.65)     traitPills.push({ label: t('trait.risk_taker')    as string, color: '#5dcaa5' })
  else if (wv.risk_tolerance < 0.30) traitPills.push({ label: t('trait.cautious')     as string, color: '#378add' })
  if (npc.work_motivation === 'achievement' || npc.work_motivation === 'duty')
    traitPills.push({ label: t('trait.hardworking') as string, color: '#5dcaa5' })
  else if (npc.work_motivation === 'coerced' || npc.work_motivation === 'survival')
    traitPills.push({ label: t('trait.lethargic')   as string, color: '#777' })
  if (npc.wealth > wealthExpect * 2.5)      traitPills.push({ label: t('trait.wealthy')       as string, color: '#f0c040' })
  else if (npc.wealth < wealthExpect * 0.3) traitPills.push({ label: t('trait.struggling')    as string, color: '#e24b4b' })
  if (npc.strong_ties.length >= 10)         traitPills.push({ label: t('trait.well_connected') as string, color: '#50a0ff' })
  else if (npc.isolation > 70 && npc.strong_ties.length < 4)
    traitPills.push({ label: t('trait.isolated_npc') as string, color: '#888' })
  if (npc.age >= 80)       traitPills.push({ label: t('trait.elder')  as string, color: '#c8a830' })
  else if (npc.age >= 65)  traitPills.push({ label: t('trait.senior') as string, color: '#a08820' })
  const traitHtml = traitPills.length > 0
    ? `<div class="sp-appearance" style="margin-top:6px">${traitPills.map(p => `<span class="sp-tag" style="background:${p.color}22;color:${p.color};border:1px solid ${p.color}44">${p.label}</span>`).join('')}</div>`
    : ''

  // Romance section: attraction bar + compatibility (only when in courtship)
  const romanceSection = npc.lifecycle.romance_target_id !== null ? (() => {
    const target = state.npcs.find(n => n.id === npc.lifecycle.romance_target_id)
    if (!target) return ''
    const attractionPct = Math.round(Math.min(100, npc.lifecycle.romance_score ?? 0))
    const compatPct     = Math.round(coupleCompatibilityPublic(npc, target) * 100)
    const mutualLove    = target.lifecycle.romance_target_id === npc.id
    return `
    <div class="sp-section">
      <div class="sp-section-title">${t('sp.romance')} — <button class="sp-npc-link" data-npc-id="${target.id}">${escapeHtml(target.name)}</button></div>
      <div class="sp-row" style="margin-bottom:2px">
        <span class="sp-label">${t('sp.attraction')}</span>
        <span class="sp-value">${attractionPct}%</span>
      </div>
      <div class="sp-bar" style="margin-bottom:6px">
        <div class="sp-bar-fill" style="width:${attractionPct}%;background:#e87ca0"></div>
      </div>
      <div class="sp-row" style="margin-bottom:2px">
        <span class="sp-label">${t('sp.compat')}</span>
        <span class="sp-value" style="color:${compatPct > 65 ? '#5dcaa5' : compatPct > 40 ? '#ef9f27' : '#e24b4b'}">${compatPct}%</span>
      </div>
      <div class="sp-bar" style="margin-bottom:6px">
        <div class="sp-bar-fill" style="width:${compatPct}%;background:${compatPct > 65 ? '#5dcaa5' : compatPct > 40 ? '#ef9f27' : '#e24b4b'};opacity:.7"></div>
      </div>
      ${mutualLove ? `<div class="sp-row" style="color:#e87ca0">${t('sp.mutual_feelings')}</div>` : ''}
    </div>`
  })() : ''

  // Heartbreak recovery bar
  const heartbreakSection = (npc.lifecycle.heartbreak_cooldown ?? 0) > 0 ? (() => {
    const totalCooldown = 30 * 24   // HEARTBREAK_COOLDOWN_TICKS
    const remaining     = npc.lifecycle.heartbreak_cooldown ?? 0
    const healedPct     = Math.round((1 - remaining / totalCooldown) * 100)
    const daysLeft      = Math.ceil(remaining / 24)
    return `
    <div class="sp-section">
      <div class="sp-section-title">${t('sp.heartbroken')}</div>
      <div class="sp-row" style="margin-bottom:2px">
        <span class="sp-label">${t('sp.healing')}</span>
        <span class="sp-value">${healedPct}% · ${daysLeft} ${t('sp.heartbreak_recovery')}</span>
      </div>
      <div class="sp-bar" style="margin-bottom:6px">
        <div class="sp-bar-fill" style="width:${healedPct}%;background:#7f77dd"></div>
      </div>
    </div>`
  })() : ''

  return `
    <!-- Pixel character avatar -->
    ${renderPixelCharacterSection()}

    <!-- Description -->
    <div class="sp-section">
      <div class="sp-description">${npc.description}</div>
    </div>

    <!-- Personal info -->
    <div class="sp-section">
      <div class="sp-section-title">${t('sp.info')}</div>
      <div class="sp-row">
        <span class="sp-label">${t('sp.age')}</span>
        <span class="sp-value">${npc.age}</span>
      </div>
      <div class="sp-row">
        <span class="sp-label">${t('sp.gender')}</span>
        <span class="sp-value">${genderLabel}</span>
      </div>
      <div class="sp-row">
        <span class="sp-label">${t('sp.marital')}</span>
        <span class="sp-value">${marital}</span>
      </div>
      <div class="sp-row">
        <span class="sp-label">${t('sp.children')}</span>
        <span class="sp-value">${npc.lifecycle.children_ids.length} ${t('sp.people')}</span>
      </div>
      <div class="sp-appearance" style="margin-top:6px">
        <span class="sp-tag">${heightLabel}</span>
        <span class="sp-tag">${buildLabel}</span>
        <span class="sp-tag">${hairLabel}</span>
        <span class="sp-tag">${skinLabel}</span>
      </div>
      ${traitHtml}
    </div>

    <!-- Status bars -->
    <div class="sp-section">
      <div class="sp-section-title">${t('sp.status')}</div>
      ${(() => {
        const actionState = npc.action_state
        const actionEmoji: Record<string, string> = {
          working: '⚒️', resting: '😴', socializing: '💬', family: '🏠',
          organizing: '✊', fleeing: '🏃', complying: '🫡', confront: '⚠️',
        }
        const actionColor: Record<string, string> = {
          working: '#c0a0ff', resting: '#7f77dd', socializing: '#5dcaa5', family: '#e87ca0',
          organizing: '#ef9f27', fleeing: '#e24b4b', complying: '#378add', confront: '#ff6b35',
        }
        const em    = actionEmoji[actionState] ?? '❓'
        const color = actionColor[actionState] ?? '#aaa'
        return `<div class="sp-row">
          <span class="sp-label">${t('sp.current_activity') as string}</span>
          <span class="sp-value" style="color:${color}">${em} ${actionState}</span>
        </div>`
      })()}
      ${statBar(t('sp.stress')     as string, npc.stress,      '#e24b4b')}
      ${statBar(t('sp.happiness')  as string, npc.happiness,   '#5dcaa5')}
      ${statBar(t('sp.grievance')  as string, npc.grievance,   '#ef9f27')}
      ${statBar(t('sp.hunger')     as string, npc.hunger,      '#e24b4b')}
      ${statBar(t('sp.exhaustion') as string, npc.exhaustion,  '#7f77dd')}
      ${statBar(t('sp.isolation')  as string, npc.isolation,   '#378add')}
      <div class="sp-row">
        <span class="sp-label">${t('sp.work_motivation')}</span>
        <span class="sp-value" style="color:#c0a0ff">${t(`motiv.${npc.work_motivation}`)}</span>
      </div>
      ${burnoutBar(npc.burnout_ticks ?? 0)}
      ${ideologicalStabilityBar(npc.dissonance_acc ?? 0, npc.susceptible ?? false)}
    </div>

    <!-- Worldview bars -->
    <div class="sp-section">
      <div class="sp-section-title">${t('sp.worldview')}</div>
      ${worldviewBar(t('sp.collectivism')   as string, npc.worldview.collectivism,    '#7f77dd')}
      ${worldviewBar(t('sp.auth_trust')     as string, npc.worldview.authority_trust, '#ef9f27')}
      ${worldviewBar(t('sp.risk_tolerance') as string, npc.worldview.risk_tolerance,  '#5dcaa5')}
    </div>

    <!-- Trust -->
    <div class="sp-section">
      <div class="sp-section-title">${t('sp.trust')}</div>
      <div class="sp-row">
        <span class="sp-label">${t('sp.competence')}</span>
        <span class="sp-value">${Math.round(trustGov.competence * 100)}%</span>
      </div>
      <div class="sp-row">
        <span class="sp-label">${t('sp.intention')}</span>
        <span class="sp-value">${Math.round(trustGov.intention * 100)}%</span>
      </div>
      <div class="sp-row">
        <span class="sp-label">${t('sp.composite')}</span>
        <span class="sp-value" style="color:${compositeTrust > 60 ? '#5dcaa5' : compositeTrust > 35 ? '#ef9f27' : '#e24b4b'}">
          ${compositeTrust}%
        </span>
      </div>
    </div>

    <!-- Network -->
    <div class="sp-section">
      <div class="sp-section-title">${t('sp.network')}</div>
      <div class="sp-row">
        <span class="sp-label">${t('sp.strong_ties')}</span>
        <span class="sp-value">${npc.strong_ties.length} ${t('sp.people')}</span>
      </div>
      <div class="sp-row">
        <span class="sp-label">${t('sp.info_ties')}</span>
        <span class="sp-value" style="color:#50a0ff">${(npc.info_ties ?? []).length} ${t('sp.people')}</span>
      </div>
      <div class="sp-row">
        <span class="sp-label">${t('sp.weak_ties')}</span>
        <span class="sp-value">${npc.weak_ties.length} ${t('sp.people')}</span>
      </div>
      <div class="sp-row">
        <span class="sp-label">${t('sp.influence')}</span>
        <span class="sp-value">${Math.round(npc.influence_score * 100)}%</span>
      </div>
      <div class="sp-row">
        <span class="sp-label">${t('sp.daily_income')}</span>
        <span class="sp-value">${(npc.daily_income ?? 0).toFixed(2)}</span>
      </div>
      ${npc.community_group !== null ? `
      <div class="sp-row">
        <span class="sp-label">${t('sp.community_group')}</span>
        <span class="sp-value" style="color:#5dcaa5">${t('sp.group')} #${npc.community_group}</span>
      </div>` : ''}
      ${solidarityBar(npc.class_solidarity ?? 0, npc.on_strike ?? false)}
      ${(() => {
        const lang = getLang()
        const cap = npc.capital ?? 0
        if (cap > 0) {
          const capColor = cap >= 60 ? '#f0c040' : cap >= 25 ? '#c8a830' : '#a08820'
          return `<div class="sp-row">
            <span class="sp-label">${spCapitalLabel(lang)}</span>
            <span class="sp-value" style="color:${capColor}">${cap.toFixed(0)}/100</span>
          </div>`
        }
        const rentsFrom = npc.capital_rents_from != null ? state.npcs[npc.capital_rents_from] : null
        if (rentsFrom?.lifecycle.is_alive) {
          return `<div class="sp-row">
            <span class="sp-label">${spRentsFromLabel(lang)}</span>
            <span class="sp-value" style="color:#8899aa">${rentsFrom.name}</span>
          </div>`
        }
        return `<div class="sp-row">
          <span class="sp-label">${spCapitalLabel(lang)}</span>
          <span class="sp-value" style="color:#666">${spNoneLabel(lang)}</span>
        </div>`
      })()}
    </div>

    <!-- Status flags -->
    ${(npc.sick || npc.criminal_record) ? `
    <div class="sp-section">
      <div class="sp-section-title">${t('sp.flags')}</div>
      ${npc.sick ? `<div class="sp-row"><span class="sp-label" style="color:#ef9f27">🤒 ${t('sp.sick')}</span><span class="sp-value">${Math.ceil(npc.sick_ticks / 24)} ${t('sp.days_remaining')}</span></div>` : ''}
      ${npc.criminal_record ? `<div class="sp-row"><span class="sp-label" style="color:#e24b4b">⚠ ${t('sp.criminal_record')}</span></div>` : ''}
    </div>` : ''}

    ${romanceSection}
    ${heartbreakSection}

    ${memorySection(npc, state.tick)}
    ${lifeStory(npc, state)}

    <div class="sp-section">
      <div class="sp-section-title">${t('sp.actions') as string}</div>
      <div class="sp-actions">
        <button class="sp-action-btn" id="sp-open-chat">${t('sp.action_start_chat') as string}</button>
        <button class="sp-action-btn" id="sp-open-edit">${t('sp.action_edit_stats') as string}</button>
      </div>
    </div>

    <!-- Daily thought (LLM, filled async above) -->
    <div class="sp-section">
      <div class="sp-section-title">${t('sp.thought')}</div>
      <div id="sp-thought-text" class="sp-thought loading">${t('sp.thought_loading')}</div>
    </div>

    ${!alive ? `
    <div class="sp-section" style="color:#e24b4b">
      ✝ ${t('sp.deceased')} — ${
        npc.lifecycle.death_cause
          ? t(`death.${npc.lifecycle.death_cause}`)
          : t('sp.unknown_cause')
      }
    </div>` : ''}
  `
}

// ── Bar helpers ────────────────────────────────────────────────────────────

// Compatibility score (0–1) between two NPCs — mirrors engine logic, kept local to avoid circular imports.
function coupleCompatibilityPublic(a: NPC, b: NPC): number {
  const dims = ['collectivism', 'authority_trust', 'risk_tolerance', 'time_preference'] as const
  const totalDiff = dims.reduce((s, d) => s + Math.abs(a.worldview[d] - b.worldview[d]), 0)
  const wv   = 1 - totalDiff / dims.length
  const age  = Math.max(0, 1 - Math.abs(a.age - b.age) / 30)
  const minW = Math.min(a.wealth, b.wealth) + 1
  const maxW = Math.max(a.wealth, b.wealth) + 1
  const wlth = Math.max(0, 1 - Math.log(maxW / minW) / Math.log(50))
  return Math.min(1, Math.max(0, wv * 0.55 + age * 0.25 + wlth * 0.20))
}

function statBar(label: string, value: number, color: string): string {
  const pct = Math.round(Math.min(100, Math.max(0, value)))
  return `
    <div class="sp-row" style="margin-bottom:2px">
      <span class="sp-label">${label}</span>
      <span class="sp-value">${pct}%</span>
    </div>
    <div class="sp-bar" style="margin-bottom:6px">
      <div class="sp-bar-fill" style="width:${pct}%;background:${color}"></div>
    </div>
  `
}

// Burnout progress — shown once strain reaches 25% (120/480 ticks)
function burnoutBar(burnoutTicks: number): string {
  if (burnoutTicks < 120) return ''
  const pct  = Math.min(100, Math.round(burnoutTicks / 480 * 100))
  const color = pct >= 100 ? '#e24b4b' : pct >= 60 ? '#ef9f27' : '#7f77dd'
  const label = pct >= 100
    ? `🔥 ${t('sp.burnout') as string}`
    : `${t('sp.burnout_risk') as string}`
  return `
    <div class="sp-row" style="margin-bottom:2px">
      <span class="sp-label" style="color:${color}">${label}</span>
      <span class="sp-value" style="color:${color}">${pct}%</span>
    </div>
    <div class="sp-bar" style="margin-bottom:6px">
      <div class="sp-bar-fill" style="width:${pct}%;background:${color}"></div>
    </div>`
}

// Ideological stability — inverse of dissonance_acc; predicts radicalization
function ideologicalStabilityBar(dissonance: number, susceptible: boolean): string {
  if (dissonance < 5) return ''
  const stability = Math.max(0, 100 - dissonance)
  const color = stability > 60 ? '#5dcaa5' : stability > 35 ? '#ef9f27' : '#e24b4b'
  return `
    <div class="sp-row" style="margin-bottom:2px">
      <span class="sp-label">${t('sp.ideological_stab') as string}</span>
      <span class="sp-value" style="color:${color}">${stability}%</span>
    </div>
    <div class="sp-bar" style="margin-bottom:6px">
      <div class="sp-bar-fill" style="width:${stability}%;background:${color};opacity:.8"></div>
    </div>
    ${susceptible ? `<div class="sp-row" style="margin-bottom:6px;color:#e24b4b;font-size:10px">${t('sp.susceptible') as string}</div>` : ''}`
}

// Class solidarity bar + on-strike indicator
function solidarityBar(solidarity: number, onStrike: boolean): string {
  const pct   = Math.round(Math.min(100, Math.max(0, solidarity)))
  const color = pct > 72 ? '#e24b4b' : pct > 55 ? '#ef9f27' : '#888'
  return `
    <div class="sp-row" style="margin-bottom:2px">
      <span class="sp-label">${t('sp.class_solidarity') as string}</span>
      <span class="sp-value" style="color:${color}">${pct}%</span>
    </div>
    <div class="sp-bar" style="margin-bottom:${onStrike ? 2 : 6}px">
      <div class="sp-bar-fill" style="width:${pct}%;background:${color};opacity:.75"></div>
    </div>
    ${onStrike ? `<div class="sp-row" style="margin-bottom:6px;color:#ef9f27;font-weight:600">${t('sp.on_strike') as string}</div>` : ''}`
}

function worldviewBar(label: string, value: number, color: string): string {
  const pct = Math.round(value * 100)
  return `
    <div class="sp-row" style="margin-bottom:2px">
      <span class="sp-label">${label}</span>
      <span class="sp-value">${pct}%</span>
    </div>
    <div class="sp-bar" style="margin-bottom:6px">
      <div class="sp-bar-fill" style="width:${pct}%;background:${color};opacity:.7"></div>
    </div>
  `
}

// ── Full memory buffer (up to 10 entries) ─────────────────────────────────────

// Memory type key → i18n key suffix mapping
const MEMORY_META: Record<string, { icon: string; key: string; sign: 1 | -1 }> = {
  trust_broken: { icon: '🔪', key: 'betrayal',  sign: -1 },
  helped:       { icon: '🫱🏻‍🫲🏼', key: 'helped',    sign:  1 },
  harmed:       { icon: '💣', key: 'harmed',    sign: -1 },
  crisis:       { icon: '🚨', key: 'crisis',    sign: -1 },
  windfall:     { icon: '🏆', key: 'windfall',  sign:  1 },
  loss:         { icon: '🕳️', key: 'loss',      sign: -1 },
  illness:      { icon: '🦠', key: 'illness',   sign: -1 },
  crime:        { icon: '🕵️‍♂️', key: 'crime',     sign: -1 },
  accident:     { icon: '🚑', key: 'accident',  sign: -1 },
}

function memorySection(npc: NPC, currentTick: number): string {
  if (!npc.memory || npc.memory.length === 0) return ''

  const rows = npc.memory.map(mem => {
    const meta = MEMORY_META[mem.type] ?? { icon: '◆', key: mem.type, sign: 1 as const }
    const w     = mem.emotional_weight          // -100 to +100
    const isPos = w >= 0
    const pct   = Math.min(100, Math.abs(w))
    const color = isPos ? '#5dcaa5' : '#e24b4b'
    const daysAgo = Math.floor((currentTick - mem.tick) / 24)
    const ago   = daysAgo <= 0
      ? t('sp.mem.today') as string
      : daysAgo === 1
        ? t('sp.mem.1day_ago') as string
        : tf('sp.mem.ndays_ago', { n: daysAgo })
    const label = (t(`sp.mem.${meta.key}`) ?? meta.key) as string
    return `
      <div class="sp-mem-row">
        <span class="sp-mem-icon">${meta.icon}</span>
        <div class="sp-mem-body">
          <div class="sp-mem-header">
            <span class="sp-mem-label">${label}</span>
            <span class="sp-mem-ago">${ago}</span>
          </div>
          <div class="sp-mem-track">
            ${isPos
              ? `<div class="sp-mem-fill" style="width:${pct / 2}%;margin-left:50%;background:${color}"></div>`
              : `<div class="sp-mem-fill" style="width:${pct / 2}%;margin-left:${50 - pct / 2}%;background:${color}"></div>`
            }
            <div class="sp-mem-center"></div>
          </div>
        </div>
      </div>`
  }).join('')

  return `
    <div class="sp-section">
      <div class="sp-section-title">${t('sp.memory') as string}</div>
      <div class="sp-mem-list">${rows}</div>
    </div>`
}
