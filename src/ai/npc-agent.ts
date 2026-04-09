// ── NPC Direct Conversation Agent ─────────────────────────────────────────
//
// Handles player ↔ NPC direct conversation. Each NPC responds in character
// based on their personality (worldview), emotional state, memories, and the
// current world context. Responses can carry small stat effects (grievance,
// fear, happiness, trust) that reflect the emotional outcome of the exchange.

import { callAI, extractJSON } from './provider'
import type { AIConfig, NPC, NPCChatTurn, WorldState } from '../types'
import { getLang } from '../i18n'
import { langDirective } from '../local/ai'
import { getRegimeProfile } from '../sim/regime-config'

// ── Response shape ─────────────────────────────────────────────────────────

export interface NPCChatEffect {
  grievance_delta?: number
  fear_delta?: number
  happiness_delta?: number
  trust_delta?: number   // applied to government.intention
}

// ── System prompt ──────────────────────────────────────────────────────────

function buildSystemPrompt(npc: NPC, state: WorldState): string {
  const regime = getRegimeProfile(state.constitution).variant

  const recentMem = npc.memory.slice(-3).map(m =>
    `${m.type}(${m.emotional_weight > 0 ? '+' : ''}${m.emotional_weight})`
  ).join(', ') || 'nothing notable'

  const econStatus = (npc.capital ?? 0) > 0
    ? `owns ${Math.round(npc.capital ?? 0)}/100 capital`
    : npc.capital_rents_from != null
      ? `rents capital, pays ${Math.round(npc.capital_rent_paid ?? 0)} coins/tick`
      : 'landless/no capital'

  return `You are ${npc.name}, a ${npc.occupation} (age ${npc.age}, ${npc.gender}) living in a ${regime} society.

PERSONALITY:
- Collectivism ${Math.round(npc.worldview.collectivism * 100)}% | Authority trust ${Math.round(npc.worldview.authority_trust * 100)}% | Risk tolerance ${Math.round(npc.worldview.risk_tolerance * 100)}%
- Work motivation: ${npc.work_motivation}

CURRENT STATE:
- Stress ${Math.round(npc.stress)}% | Happiness ${Math.round(npc.happiness)}% | Grievance ${Math.round(npc.grievance)}%
- Hunger ${Math.round(npc.hunger)}% | Fear ${Math.round(npc.fear)}%
- Wealth: ${Math.round(npc.wealth)} coins | ${econStatus}
${npc.on_strike ? '- ON STRIKE: demanding better conditions' : ''}
${npc.sick ? '- Currently sick and suffering' : ''}
${npc.criminal_record ? '- Has a criminal record' : ''}

RECENT MEMORIES: ${recentMem}
WORLD: stability ${Math.round(state.macro.stability)}%, food ${Math.round(state.macro.food)}%, gini ${state.macro.gini.toFixed(2)}
Active crises: ${state.active_events.map(e => e.type).join(', ') || 'none'}

Respond as ${npc.name} in first person. Stay in character — reflect your stress, grievance, and worldview in your tone. 2–4 sentences max. No meta-commentary.

Return JSON ONLY:
{"text":"your spoken response","effect":{"grievance_delta":<-10..10>,"fear_delta":<-10..10>,"happiness_delta":<-10..10>,"trust_delta":<-0.1..0.1>}}
Only include "effect" keys that the conversation actually changes. Omit "effect" entirely if the exchange has no emotional impact.

${langDirective(getLang())}`
}

// ── Public API ─────────────────────────────────────────────────────────────

export async function handleNPCChat(
  npc: NPC,
  userMessage: string,
  history: NPCChatTurn[],
  state: WorldState,
  config: AIConfig,
): Promise<{ text: string; effect?: NPCChatEffect }> {
  const historyCtx = history.slice(-6).map(t =>
    t.speaker === 'player' ? `Stranger: "${t.text}"` : `${npc.name}: "${t.text}"`
  ).join('\n')

  const prompt = historyCtx
    ? `Previous exchange:\n${historyCtx}\n\nStranger says: "${userMessage}"`
    : `A stranger approaches and says: "${userMessage}"`

  const raw = await callAI(config, buildSystemPrompt(npc, state), prompt, 256)

  try {
    const json = JSON.parse(extractJSON(raw))
    return { text: String(json.text ?? raw.trim()).slice(0, 400), effect: json.effect }
  } catch {
    return { text: raw.trim().slice(0, 400) }
  }
}
