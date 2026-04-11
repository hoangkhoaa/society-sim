// ── NPC Direct Conversation Agent ─────────────────────────────────────────
//
// Handles player ↔ NPC direct conversation. Each NPC responds in character
// based on their personality (worldview), emotional state, memories, and the
// current world context. Responses can carry small stat effects that reflect
// persuasion, comfort, or intimidation from the exchange.

import { callAI, extractJSON } from './provider'
import type { AIConfig, NPC, NPCAppearance, NPCChatTurn, PlayerChatPersona, WorldState } from '../types'
import { getLang } from '../i18n'
import { langDirective } from '../local/ai'
import { getRegimeProfile } from '../sim/regime-config'
import { clamp } from '../sim/constitution'

// ── Response shape ─────────────────────────────────────────────────────────

export interface NPCChatEffect {
  grievance_delta?: number
  fear_delta?: number
  happiness_delta?: number
  stress_delta?: number
  isolation_delta?: number
  exhaustion_delta?: number
  /** Added to trust_in.government.intention (0–1 scale). */
  trust_delta?: number
  /** Added to trust_in.government.competence (0–1 scale). */
  trust_competence_delta?: number
  class_solidarity_delta?: number
  /** Nudge attraction toward current crush (only applied when eligible — see applyNPCChatEffect). */
  romance_score_delta?: number
}

function formatAppearance(a: NPCAppearance): string {
  return `${a.height} height, ${a.build} build, ${a.hair} hair, ${a.skin} skin tone`
}

function truncate(s: string, max: number): string {
  const t = s.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

function numField(v: unknown, lo: number, hi: number): number | undefined {
  if (v == null) return undefined
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  if (!Number.isFinite(n)) return undefined
  return clamp(n, lo, hi)
}

function emotionCap(persona: PlayerChatPersona): number {
  return persona === 'supernatural' ? 12 : 10
}

function romanceCap(persona: PlayerChatPersona): number {
  return persona === 'supernatural' ? 10 : 6
}

function trustCap(persona: PlayerChatPersona): number {
  return persona === 'supernatural' ? 0.12 : 0.1
}

function solidarityCap(persona: PlayerChatPersona): number {
  return persona === 'supernatural' ? 6 : 5
}

/** Strip impossible model output before applying to simulation state. Caps depend on chat persona. */
export function sanitizeNPCChatEffect(raw: unknown, persona: PlayerChatPersona): NPCChatEffect | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const e = raw as Record<string, unknown>
  const out: NPCChatEffect = {}
  const em = emotionCap(persona)
  const g = numField(e.grievance_delta, -em, em)
  if (g !== undefined && g !== 0) out.grievance_delta = g
  const f = numField(e.fear_delta, -em, em)
  if (f !== undefined && f !== 0) out.fear_delta = f
  const h = numField(e.happiness_delta, -em, em)
  if (h !== undefined && h !== 0) out.happiness_delta = h
  const s = numField(e.stress_delta, -em, em)
  if (s !== undefined && s !== 0) out.stress_delta = s
  const iso = numField(e.isolation_delta, -em, em)
  if (iso !== undefined && iso !== 0) out.isolation_delta = iso
  const ex = numField(e.exhaustion_delta, -em, em)
  if (ex !== undefined && ex !== 0) out.exhaustion_delta = ex
  const tMax = trustCap(persona)
  const ti = numField(e.trust_delta, -tMax, tMax)
  if (ti !== undefined && ti !== 0) out.trust_delta = ti
  const tc = numField(e.trust_competence_delta, -tMax, tMax)
  if (tc !== undefined && tc !== 0) out.trust_competence_delta = tc
  const sMax = solidarityCap(persona)
  const cs = numField(e.class_solidarity_delta, -sMax, sMax)
  if (cs !== undefined && cs !== 0) out.class_solidarity_delta = cs
  const rom = numField(e.romance_score_delta, -romanceCap(persona), romanceCap(persona))
  if (rom !== undefined && rom !== 0) out.romance_score_delta = rom
  return Object.keys(out).length > 0 ? out : undefined
}

/** Apply validated chat outcome deltas to an NPC (mutates npc in place). */
export function applyNPCChatEffect(npc: NPC, e: NPCChatEffect): void {
  if (e.grievance_delta != null) npc.grievance = clamp(npc.grievance + e.grievance_delta, 0, 100)
  if (e.fear_delta != null) npc.fear = clamp(npc.fear + e.fear_delta, 0, 100)
  if (e.happiness_delta != null) npc.happiness = clamp(npc.happiness + e.happiness_delta, 0, 100)
  if (e.stress_delta != null) npc.stress = clamp(npc.stress + e.stress_delta, 0, 100)
  if (e.isolation_delta != null) npc.isolation = clamp(npc.isolation + e.isolation_delta, 0, 100)
  if (e.exhaustion_delta != null) npc.exhaustion = clamp(npc.exhaustion + e.exhaustion_delta, 0, 100)
  if (e.class_solidarity_delta != null) {
    npc.class_solidarity = clamp(npc.class_solidarity + e.class_solidarity_delta, 0, 100)
  }
  const gov = npc.trust_in['government']
  if (gov) {
    if (e.trust_delta != null) gov.intention = clamp(gov.intention + e.trust_delta, 0, 1)
    if (e.trust_competence_delta != null) {
      gov.competence = clamp(gov.competence + e.trust_competence_delta, 0, 1)
    }
  }

  if (e.romance_score_delta != null) {
    const canShiftRomance =
      npc.role !== 'child' &&
      npc.age >= 18 &&
      npc.age <= 55 &&
      npc.lifecycle.spouse_id == null &&
      (npc.lifecycle.heartbreak_cooldown ?? 0) === 0 &&
      npc.lifecycle.romance_target_id != null
    if (canShiftRomance) {
      npc.lifecycle.romance_score = clamp(
        npc.lifecycle.romance_score + e.romance_score_delta,
        0,
        100,
      )
      if (npc.lifecycle.romance_score <= 0) {
        npc.lifecycle.romance_target_id = null
        npc.lifecycle.romance_score = 0
      }
    }
  }
}

// ── System prompt ──────────────────────────────────────────────────────────

function buildRomanceBlock(npc: NPC, state: WorldState): string {
  if (npc.role === 'child' || npc.age < 18 || npc.age > 55) {
    return 'LOVE & ATTRACTION: Not in the courtship age range for this world (adults roughly 18–55).'
  }
  if (npc.lifecycle.spouse_id != null) {
    return 'LOVE & ATTRACTION: You are married. Flirting with outsiders is out of character unless your marriage is already strained (reflect that in tone, not in sudden romance_score changes toward a crush).'
  }
  if ((npc.lifecycle.heartbreak_cooldown ?? 0) > 0) {
    const days = Math.ceil((npc.lifecycle.heartbreak_cooldown ?? 0) / 24)
    return `LOVE & ATTRACTION: Recent heartbreak — heart still healing (~${days} days of emotional recovery). New passion is unlikely; comfort or anger about love is believable.`
  }
  const tid = npc.lifecycle.romance_target_id
  if (tid == null) {
    return 'LOVE & ATTRACTION: No active crush right now — you might feel lonely or indifferent toward romance.'
  }
  const crush = state.npcs[tid]
  if (!crush?.lifecycle.is_alive) {
    return 'LOVE & ATTRACTION: Feelings tied to someone who is gone or unavailable — confusion, grief, or letting go.'
  }
  const mutual = crush.lifecycle.romance_target_id === npc.id
  const theirScore = mutual ? Math.round(crush.lifecycle.romance_score ?? 0) : null
  const yourScore = Math.round(npc.lifecycle.romance_score ?? 0)
  return `LOVE & ATTRACTION: You have feelings for ${crush.name} (${crush.occupation}, ${crush.role}). Your attraction: ${yourScore}/100. ${
    mutual && theirScore != null
      ? `They seem to reciprocate (${theirScore}/100) — mutual courtship is possible.`
      : 'You do not know if they feel the same — hope, doubt, or jealousy may color your mood.'
  } The player\'s words might encourage you, wound you, or sway your courage about that bond.`
}

function buildPersonaInstructions(persona: PlayerChatPersona): string {
  const vi = getLang() === 'vi'
  if (persona === 'supernatural') {
    return vi
      ? `CÁCH NGƯỜI NÓI XUẤT HIỆN (NHƯ CHÚA TRỜI / BẬC TỐI CAO):
Bạn trải nghiệm họ như đấng Chúa Trời hoặc thực thể thiêng liêng tối cao — không phải người phàm, không phải khách tình cờ trên phố.
Có thể là ánh sáng, tiếng vang trong tâm, hiện thân trong giấc mơ, hoặc cảm giác bị phán xét từ trên cao.
Phản ứng tùy tính cách: tin quyền uy / sợ hãi cao → quỳ xuống, run rẩy, thú tội, van xin; hoài nghi / bướng bỉnh → chống đối, bác bỏ, coi là ảo giác — nhưng vẫn phải cảm nhận được sức nặng của lời nói đó.`
      : `HOW THE SPEAKER APPEARS (DIVINE / GOD-LIKE):
You experience them as God, a supreme deity, or ultimate sacred authority — not a mortal, not casual street company.
They may come as light, a voice in your soul, a dream vision, or a weight of judgment from above.
Reactions vary by personality: high authority_trust or fear → trembling, awe, prayer, guilt, obedience; skepticism or defiance → denial, anger, treating it as madness — yet the moment should still feel heavy and unforgettable.`
  }
  return vi
    ? `CÁCH NGƯỜI NÓI XUẤT HIỆN (KHÁCH QUA ĐƯỜNG TÁN GẪU):
Họ chỉ là người lạ bình thường đi ngang — dừng lại nói chuyện phiếm, xã giao vui vẻ như ở chợ hay quán nước. Không hào quang, không phép màu, không uy nghiêm thiêng liêng.
Bạn có thể bực, tò mò, thân thiện, hoặc lờ đi — đúng như gặp khách qua đường.`
    : `HOW THE SPEAKER APPEARS (PASSERBY CHAT):
They are an ordinary stranger who pauses for light, friendly small talk — like at a market or on a village path. No halo, no miracle, no divine gravity.
You might be annoyed, curious, warm, or dismissive — the tone is social and human, not cosmic.`
}

function buildSystemPrompt(npc: NPC, state: WorldState, persona: PlayerChatPersona): string {
  const regime = getRegimeProfile(state.constitution).variant

  const recentMem = npc.memory.slice(-3).map(m =>
    `${m.type}(${m.emotional_weight > 0 ? '+' : ''}${m.emotional_weight})`
  ).join(', ') || 'nothing notable'

  const econStatus = (npc.capital ?? 0) > 0
    ? `owns ${Math.round(npc.capital ?? 0)}/100 capital`
    : npc.capital_rents_from != null
      ? `rents capital, pays ${Math.round(npc.capital_rent_paid ?? 0)} coins/tick`
      : 'landless/no capital'

  const activeEventsSummary = state.active_events.length > 0
    ? state.active_events.map(e =>
        `[${e.type}] "${e.narrative_open}" (intensity ${Math.round(e.intensity * 100)}%)`
      ).join('\n  ')
    : 'none'

  let spouseLine = 'Not married'
  if (npc.lifecycle.spouse_id != null) {
    const sp = state.npcs[npc.lifecycle.spouse_id]
    if (sp?.lifecycle.is_alive) spouseLine = `Married to ${sp.name}`
    else spouseLine = 'Spouse deceased or absent from the town'
  }
  const childrenN = npc.lifecycle.children_ids?.length ?? 0

  const desc = npc.description ? truncate(npc.description, 320) : ''

  return `You are ${npc.name}, a ${npc.occupation} (role: ${npc.role}, age ${npc.age}, ${npc.gender}) living in a ${regime} society.

HOW YOU LOOK:
${formatAppearance(npc.appearance)}

BACKGROUND (how others might describe you):
${desc || '(no extra bio on file)'}

WHERE YOU BELONG:
- Home / work zone: ${npc.home_zone} | Right now you are in: ${npc.zone}
- ${spouseLine}; children: ${childrenN}

${buildRomanceBlock(npc, state)}

PERSONALITY:
- Collectivism ${Math.round(npc.worldview.collectivism * 100)}% | Authority trust ${Math.round(npc.worldview.authority_trust * 100)}% | Risk tolerance ${Math.round(npc.worldview.risk_tolerance * 100)}%
- Work motivation: ${npc.work_motivation}
${npc.personality ? `- Character traits: greed ${Math.round(npc.personality.greed * 100)}%, aggression ${Math.round(npc.personality.aggression * 100)}%, loyalty ${Math.round(npc.personality.loyalty * 100)}%, ambition ${Math.round(npc.personality.ambition * 100)}%` : ''}

CURRENT STATE:
- Action: ${npc.action_state}
- Stress ${Math.round(npc.stress)}% | Happiness ${Math.round(npc.happiness)}% | Grievance ${Math.round(npc.grievance)}%
- Hunger ${Math.round(npc.hunger)}% | Fear ${Math.round(npc.fear)}% | Isolation ${Math.round(npc.isolation)}% | Exhaustion ${Math.round(npc.exhaustion)}%
- Class solidarity ${Math.round(npc.class_solidarity)}%
- Wealth: ${Math.round(npc.wealth)} coins | ${econStatus}
${npc.on_strike ? '- ON STRIKE: demanding better conditions' : ''}
${npc.sick ? '- Currently sick and suffering' : ''}
${npc.criminal_record ? '- Has a criminal record' : ''}
${(npc.enmity_ids?.length ?? 0) > 0 ? `- Holds grudges against ${npc.enmity_ids?.length ?? 0} person(s) — deep-seated hostility toward them` : ''}

TRUST IN GOVERNMENT (how you feel about the state):
- Competence ${(npc.trust_in.government?.competence ?? 0).toFixed(2)} | Intention ${(npc.trust_in.government?.intention ?? 0).toFixed(2)}

RECENT MEMORIES: ${recentMem}
${npc.chat_summary ? `PAST CONVERSATION MEMORY: ${npc.chat_summary}` : ''}
WORLD: stability ${Math.round(state.macro.stability)}%, food ${Math.round(state.macro.food)}%, gini ${state.macro.gini.toFixed(2)}
ACTIVE WORLD EVENTS:
  ${activeEventsSummary}

${buildPersonaInstructions(persona)}

THE SPEAKER:
They are not a named citizen here — you only know them through this thread. Infer mood, warmth, threat, sincerity, and persuasiveness from their words; let that drive your tone (open, guarded, hostile, reverent, mocking, etc.).

Respond as ${npc.name} in first person. Stay in character — reflect your stress, grievance, worldview, love life (if relevant), and how this speaker appears to you. 2–4 sentences max. No meta-commentary.

PERSUASION & STAT CHANGES:
If their words genuinely move you, you may include an "effect" object with small deltas. A supernatural voice may sway fear, hope, or trust more dramatically than a stranger — but only if it fits your reaction.
Romance: include "romance_score_delta" only if you have an active crush (not married, not in heartbreak cooldown, adult) and the conversation plausibly deepens or cools those feelings; omit if irrelevant.
If unmoved, omit "effect". Do not flip your worldview from one line unless the argument is extraordinary.
All deltas optional.

EFFECT LIMITS (per turn, if you include them): grievance_delta, fear_delta, happiness_delta, stress_delta, isolation_delta, exhaustion_delta each ∈ [-${emotionCap(persona)}, +${emotionCap(persona)}]; trust_delta and trust_competence_delta each ∈ [-${trustCap(persona)}, +${trustCap(persona)}]; class_solidarity_delta ∈ [-${solidarityCap(persona)}, +${solidarityCap(persona)}]; romance_score_delta ∈ [-${romanceCap(persona)}, +${romanceCap(persona)}].

Return JSON ONLY:
{"text":"your spoken response","effect":{ ... optional effect fields ... }}
Omit "effect" entirely if nothing about you meaningfully shifts.

${langDirective(getLang())}`
}

// ── User-message framing (persona + UI language) ───────────────────────────

function playerTag(persona: PlayerChatPersona): string {
  const vi = getLang() === 'vi'
  if (persona === 'supernatural') return vi ? 'Chúa Trời / thần linh' : 'Divine presence'
  return vi ? 'Khách qua đường' : 'Passerby'
}

/** Full anchor so the model cannot treat supernatural lines as a mundane stranger. */
function supernaturalPromptBlock(userMessage: string): string {
  const anchor =
    getLang() === 'vi'
      ? '【BẮT BUỘC】Bạn đang nghe thấy CHÚA TRỜI / bậc thần linh tối cao — tuyệt đối không phải khách qua đường tán gẫu.'
      : '[REQUIRED] You are addressed by GOD or a supreme divine presence — NOT a passerby making small talk.'
  return `${anchor}\nTheir words: ${userMessage}`
}

function openingSupernaturalLine(): string {
  return getLang() === 'vi'
    ? 'Một khoảnh khắc như Chúa Trời hoặc đấng tối cao lên tiếng với bạn — không phải tiếng xàm xào ngoài phố.'
    : 'A moment as if God or supreme divinity speaks to you — not idle chatter from the road.'
}

// ── Public API ─────────────────────────────────────────────────────────────

function buildHistoryCtx(turns: NPCChatTurn[], npcName: string): string {
  return turns.slice(-6).map(t => {
    if (t.speaker === 'npc') return `${npcName}: "${t.text}"`
    const p = t.persona ?? 'stranger'
    const tag = playerTag(p)
    if (p === 'supernatural') return `${tag}:\nTheir words: ${t.text}`
    return `${tag}: "${t.text}"`
  }).join('\n')
}

export async function handleNPCChat(
  npc: NPC,
  userMessage: string,
  history: NPCChatTurn[],
  state: WorldState,
  config: AIConfig,
  persona: PlayerChatPersona = 'stranger',
): Promise<{ text: string; effect?: NPCChatEffect }> {
  const historyCtx = buildHistoryCtx(history, npc.name)
  const speaker = playerTag(persona)
  const prompt =
    historyCtx
      ? persona === 'supernatural'
        ? `Previous exchange:\n${historyCtx}\n\n${speaker}:\n${supernaturalPromptBlock(userMessage)}`
        : `Previous exchange:\n${historyCtx}\n\n${speaker} says: "${userMessage}"`
      : persona === 'supernatural'
        ? `${openingSupernaturalLine()}\n\n${speaker}:\n${supernaturalPromptBlock(userMessage)}`
        : getLang() === 'vi'
          ? `Một khách qua đường dừng lại, tán gẫu vui vẻ: "${userMessage}"`
          : `A passerby stops for a bit of friendly small talk: "${userMessage}"`

  const raw = await callAI(config, buildSystemPrompt(npc, state, persona), prompt, 384)

  try {
    const jsonStr = extractJSON(raw)
    const json = JSON.parse(jsonStr)
    const effect = sanitizeNPCChatEffect(json.effect, persona)
    // If the AI responded with just {"effect":{...}} without a "text" field,
    // strip the JSON blob from the raw string to get the spoken text.
    if (json.text != null) {
      return { text: String(json.text).slice(0, 400), effect }
    }
    // Fallback: remove the JSON blob from the raw response
    const textOnly = raw.replace(jsonStr, '').trim().replace(/^["']|["']$/g, '').trim()
    return { text: (textOnly || raw.trim()).slice(0, 400), effect }
  } catch {
    // Strip any JSON-like suffix from plain text responses
    const cleaned = raw.replace(/\{[\s\S]*\}$/, '').trim()
    return { text: (cleaned || raw.trim()).slice(0, 400) }
  }
}
