// ── Science Discovery — Localization, Templates & Prompts ─────────────────────
// Provides templates (fallback mode) and LLM prompt builders for the science
// AI agent.  Discoveries are inspired by real social conditions: famines spark
// agricultural innovations, epidemics drive medical breakthroughs, inequality
// breeds social-reform theories, literacy enables scientific method, etc.

import type { Lang } from '../i18n'
import type { WorldState, FormulaPatch } from '../types'
import { pick } from './common'

// ── Science scan snapshot ──────────────────────────────────────────────────

export interface ScienceScan {
  population: number
  literacy: number
  stability: number
  food: number
  gini: number
  trust: number
  avgHappiness: number
  avgStress: number
  avgGrievance: number
  scholarPct: number
  scholarAvgHappiness: number
  sickPct: number
  epidemicActive: boolean
  droughtActive: boolean
  foodCrisisRecent: boolean
  highInequality: boolean
  organizingPct: number
  researchPoints: number
  discoveriesCount: number
  healthcarePresence: boolean
}

// ── AI-generated discovery structure ──────────────────────────────────────

export interface ScienceDiscovery {
  /** Internal field identifier (e.g. 'germ_theory', 'crop_rotation_v2') */
  field: string
  /** Short display name (2-5 words) */
  name: string
  /** One-sentence description of the discovery and its origin in social practice */
  description: string
  /** Name of the discoverer NPC (or archetype if none credited) */
  discoverer_name?: string
  /** Permanent constitution parameter changes (small deltas, e.g. +0.03) */
  constitution_patch?: {
    safety_net?: number
    market_freedom?: number
    network_cohesion?: number
    base_trust?: number
    individual_rights_floor?: number
  }
  /** One-time NPC stat effects applied at discovery */
  npc_happiness_delta?: number
  npc_stress_delta?: number
  npc_grievance_delta?: number
  scholar_happiness_delta?: number
  /** One-time food stock bonus/penalty */
  food_stock_delta?: number
  /**
   * Permanent formula expression patches — for truly paradigm-shifting
   * discoveries that alter how the simulation computes macro or NPC stats.
   * Each entry replaces the named formula expression for the rest of the session.
   */
  formula_patch?: FormulaPatch[]
}

// ── Template discoveries ───────────────────────────────────────────────────

interface ScienceTemplate {
  cond: (s: ScienceScan) => boolean
  discovery: (s: ScienceScan, lang: Lang) => ScienceDiscovery
}

export const SCIENCE_TEMPLATES: ScienceTemplate[] = [
  // Epidemic → germ theory / public health
  {
    cond: s => s.epidemicActive && s.sickPct > 15,
    discovery: (_s, lang) => ({
      field: 'germ_theory',
      name:  pick(lang, { en: 'Theory of Contagion', vi: 'Lý thuyết lây bệnh' }),
      description: pick(lang, {
        en: 'Healers observing the epidemic trace illness to contact — washing hands and isolating the sick halves the death toll.',
        vi: 'Thầy thuốc theo dõi dịch bệnh phát hiện bệnh lây qua tiếp xúc — rửa tay và cách ly người bệnh giúp giảm một nửa tỉ lệ tử vong.',
      }),
      discoverer_name: pick(lang, { en: 'the town physician', vi: 'thầy thuốc trong làng' }),
      constitution_patch: { safety_net: 0.03 },
      npc_stress_delta: -4,
    }),
  },

  // Drought → irrigation / water management
  {
    cond: s => s.droughtActive && s.food < 40,
    discovery: (_s, lang) => ({
      field: 'irrigation',
      name:  pick(lang, { en: 'Irrigation Canals', vi: 'Kênh tưới tiêu' }),
      description: pick(lang, {
        en: 'Farmers, desperate under drought, dig irrigation channels — permanently improving water access and crop yields.',
        vi: 'Nông dân tuyệt vọng trong hạn hán đào kênh dẫn nước — cải thiện vĩnh viễn nguồn nước và năng suất mùa màng.',
      }),
      discoverer_name: pick(lang, { en: 'a farmer collective', vi: 'nhóm nông dân' }),
      constitution_patch: { safety_net: 0.02 },
      food_stock_delta: 800,
    }),
  },

  // Food crisis → crop rotation
  {
    cond: s => s.foodCrisisRecent && !s.droughtActive && s.food < 35,
    discovery: (_s, lang) => ({
      field: 'crop_rotation',
      name:  pick(lang, { en: 'Crop Rotation', vi: 'Luân canh cây trồng' }),
      description: pick(lang, {
        en: 'Facing chronic shortages, farmers experiment with rotating crops each season — soil recovers faster and yields rise.',
        vi: 'Đối mặt với thiếu hụt lương thực, nông dân thử nghiệm luân canh cây trồng mỗi mùa — đất phục hồi nhanh hơn và năng suất tăng.',
      }),
      discoverer_name: pick(lang, { en: 'village elders', vi: 'các trưởng làng' }),
      food_stock_delta: 600,
      npc_happiness_delta: 3,
    }),
  },

  // High inequality + unrest → social contract theory
  {
    cond: s => s.highInequality && s.avgGrievance > 55 && s.organizingPct > 5,
    discovery: (_s, lang) => ({
      field: 'social_contract',
      name:  pick(lang, { en: 'Social Contract Theory', vi: 'Lý thuyết khế ước xã hội' }),
      description: pick(lang, {
        en: 'Scholars witnessing inequality and unrest codify the idea that rulers derive legitimacy from the governed — trust in institutions gradually rises.',
        vi: 'Học giả chứng kiến bất bình đẳng và bạo loạn hệ thống hóa ý tưởng rằng người cai trị chỉ hợp pháp khi được dân chấp thuận — niềm tin vào thể chế dần tăng.',
      }),
      discoverer_name: pick(lang, { en: 'a dissident scholar', vi: 'một học giả bất đồng' }),
      constitution_patch: { base_trust: 0.03, individual_rights_floor: 0.04 },
      npc_grievance_delta: -6,
      npc_happiness_delta: 4,
    } as ScienceDiscovery),
  },

  // High literacy + scholars → scientific method
  {
    cond: s => s.literacy > 65 && s.scholarPct > 8 && s.scholarAvgHappiness > 55,
    discovery: (_s, lang) => ({
      field: 'scientific_method',
      name:  pick(lang, { en: 'The Scientific Method', vi: 'Phương pháp khoa học' }),
      description: pick(lang, {
        en: 'Scholars develop systematic observation and testing — knowledge accumulates faster and public trust in expertise rises.',
        vi: 'Học giả phát triển phương pháp quan sát và kiểm tra có hệ thống — kiến thức tích lũy nhanh hơn và niềm tin công chúng vào chuyên môn tăng cao.',
      }),
      discoverer_name: pick(lang, { en: 'the academy of scholars', vi: 'học viện học giả' }),
      constitution_patch: { base_trust: 0.02, network_cohesion: 0.02 },
      scholar_happiness_delta: 12,
    }),
  },

  // Low stability + high stress → conflict resolution / diplomacy
  {
    cond: s => s.stability < 35 && s.avgStress > 65 && s.trust < 40,
    discovery: (_s, lang) => ({
      field: 'conflict_resolution',
      name:  pick(lang, { en: 'Diplomacy & Mediation', vi: 'Ngoại giao và hòa giải' }),
      description: pick(lang, {
        en: 'Born from exhaustion with conflict, community leaders formalize peaceful negotiation — reducing social tension permanently.',
        vi: 'Ra đời từ sự mệt mỏi với xung đột, các lãnh đạo cộng đồng thiết lập đàm phán hòa bình — giảm căng thẳng xã hội vĩnh viễn.',
      }),
      discoverer_name: pick(lang, { en: 'community mediators', vi: 'những người hòa giải cộng đồng' }),
      constitution_patch: { base_trust: 0.04, network_cohesion: 0.03 },
      npc_stress_delta: -7,
    }),
  },

  // Healthcare workers + epidemic → quarantine protocols
  {
    cond: s => s.healthcarePresence && s.epidemicActive,
    discovery: (_s, lang) => ({
      field: 'quarantine',
      name:  pick(lang, { en: 'Quarantine Protocols', vi: 'Quy trình cách ly dịch tễ' }),
      description: pick(lang, {
        en: 'Healthcare workers devise organized isolation of the sick — epidemic spread slows and deaths decline.',
        vi: 'Nhân viên y tế thiết lập quy trình cách ly có tổ chức — tốc độ lây lan dịch bệnh giảm và số ca tử vong giảm.',
      }),
      discoverer_name: pick(lang, { en: 'the medical corps', vi: 'đội ngũ y tế' }),
      constitution_patch: { safety_net: 0.04 },
      npc_stress_delta: -5,
    }),
  },

  // Merchant-driven discovery: trade law / contract law
  {
    cond: s => s.gini < 0.45 && s.literacy > 40 && s.stability > 55,
    discovery: (_s, lang) => ({
      field: 'contract_law',
      name:  pick(lang, { en: 'Written Contract Law', vi: 'Luật hợp đồng thành văn' }),
      description: pick(lang, {
        en: 'Merchants and scholars codify trade agreements into enforceable written contracts — commerce becomes more trustworthy.',
        vi: 'Thương nhân và học giả hệ thống hóa các thỏa thuận thương mại thành hợp đồng thành văn có thể thực thi — thương mại trở nên đáng tin cậy hơn.',
      }),
      discoverer_name: pick(lang, { en: 'merchant scholars', vi: 'học giả thương nhân' }),
      constitution_patch: { market_freedom: 0.03, base_trust: 0.02 },
      npc_happiness_delta: 3,
    }),
  },

  // Generic fallback: observation of nature
  {
    cond: () => true,
    discovery: (_s, lang) => ({
      field: 'natural_philosophy',
      name:  pick(lang, { en: 'Natural Philosophy', vi: 'Triết học tự nhiên' }),
      description: pick(lang, {
        en: 'Curious minds record patterns in nature — weather, seasons, plant growth — laying groundwork for applied science.',
        vi: 'Những tâm hồn tò mò ghi chép các quy luật của tự nhiên — thời tiết, mùa vụ, sinh trưởng của cây — đặt nền tảng cho khoa học ứng dụng.',
      }),
      discoverer_name: pick(lang, { en: 'wandering observers', vi: 'những người quan sát lang thang' }),
      constitution_patch: { network_cohesion: 0.01 },
      scholar_happiness_delta: 6,
    }),
  },
]

export function resolveScienceTemplate(scan: ScienceScan, lang: Lang): ScienceDiscovery | null {
  for (const t of SCIENCE_TEMPLATES) {
    if (t.cond(scan)) return t.discovery(scan, lang)
  }
  return null
}

// ── AI system prompt ───────────────────────────────────────────────────────

export function scienceSystemPrompt(lang: Lang): string {
  const directive = lang === 'vi' ? 'Respond in Vietnamese.' : 'Respond in English.'
  return `You are the Science Oracle — an AI agent observing a society simulation and generating rare, society-inspired scientific discoveries.

Discoveries MUST emerge from real social conditions (famine → food science, epidemic → medicine, inequality → social theory, etc.).
Each discovery permanently changes the society in a meaningful but modest way.

ALWAYS return valid JSON matching this schema (no extra text):
{
  "field": "short_id",
  "name": "2-5 word discovery name",
  "description": "One vivid sentence: what was discovered, how social conditions inspired it, and the permanent change.",
  "discoverer_name": "archetype or individual who made the breakthrough",
  "constitution_patch": {
    "safety_net": <-0.05 to 0.05 or omit>,
    "market_freedom": <-0.05 to 0.05 or omit>,
    "network_cohesion": <-0.04 to 0.04 or omit>,
    "base_trust": <-0.04 to 0.04 or omit>,
    "individual_rights_floor": <-0.04 to 0.04 or omit>
  },
  "npc_happiness_delta": <-10 to 15 or omit>,
  "npc_stress_delta": <-10 to 5 or omit>,
  "scholar_happiness_delta": <0 to 20 or omit>,
  "food_stock_delta": <-500 to 1200 or omit>,
  "formula_patch": [
    {"key": "stability"|"polarization"|"labor_unrest"|"stress"|"happiness"|"birth_chance",
     "expr": "<valid JS expression using the formula's parameter names>"}
  ]
}

Formula parameter names (must use exactly):
- stability:    avgTrustGov, cohesion, food, avgStress, politicalPressure  → result 0-100
- polarization: stdCollectivism, stdAuthority, centerDrift                 → result 0-100
- labor_unrest: avgSolidarity, gini                                        → result 0-100
- stress:       hunger, exhaustion, isolation, fear, identityStress, socialBuffer → inner sum (×100 applied automatically)
- happiness:    stressPenalty, relativeStatus, inequalityPain, memoryEffect, trustBonus → result around 0-100
- birth_chance: baseFertility, happinessFactor, stressFactor, fearFactor, needsFactor, wealthFactor, trustFactor, foodFactor → result ~0.00015

Rules:
- Keep constitution_patch values small (±0.01 to ±0.05 at most) — discoveries nudge but don't overhaul society
- Use formula_patch ONLY for truly paradigm-shifting discoveries (new understanding of human psychology, revolutionary agricultural science, etc.)
- Formula patches are PERMANENT for the session — use rarely and with clear thematic justification
- Choose effects that make thematic sense with the discovery type
- The "field" must be a lowercase snake_case id unique to this discovery
- Make the description vivid but concise (one sentence)
- Omit formula_patch entirely for ordinary discoveries

${directive}`
}

// ── AI snapshot prompt ─────────────────────────────────────────────────────

export function scienceSnapshotPrompt(state: WorldState, scan: ScienceScan, lang: Lang): string {
  const existingDiscoveries = state.discoveries.map(d => d.name).join(', ') || 'none yet'
  const directive = lang === 'vi' ? 'Write in Vietnamese.' : 'Write in English.'

  return `SOCIETY SNAPSHOT (Year ${state.year}, Day ${state.day}):
Population: ${scan.population}
Literacy: ${scan.literacy.toFixed(0)}%
Stability: ${scan.stability.toFixed(0)}%
Food supply: ${scan.food.toFixed(0)}%
Inequality (Gini): ${(scan.gini * 100).toFixed(0)}%
Trust in institutions: ${scan.trust.toFixed(0)}%
Average happiness: ${scan.avgHappiness.toFixed(0)}%
Average stress: ${scan.avgStress.toFixed(0)}%
Average grievance: ${scan.avgGrievance.toFixed(0)}%
Scholars: ${scan.scholarPct.toFixed(1)}% of population
Organizing NPCs: ${scan.organizingPct.toFixed(1)}%
Sick NPCs: ${scan.sickPct.toFixed(1)}%

Active crises: ${[
    scan.epidemicActive ? 'epidemic' : null,
    scan.droughtActive  ? 'drought'  : null,
    scan.foodCrisisRecent && !scan.droughtActive ? 'food shortage' : null,
    scan.highInequality ? 'high inequality' : null,
  ].filter(Boolean).join(', ') || 'none'}

Already discovered: ${existingDiscoveries}
Research points accumulated: ${state.research_points.toFixed(0)}

Based on these social conditions, generate ONE contextual scientific discovery that:
1. Emerges naturally from the most pressing social condition listed above
2. Has NOT already been discovered (check the "already discovered" list)
3. Permanently improves (or sometimes worsens) the society in a thematically consistent way
4. Is historically plausible for a pre-industrial society

${directive}`
}
