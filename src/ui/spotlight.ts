import type { NPC, WorldState, AIConfig } from '../types'
import { generateNPCThought } from '../ai/god-agent'
import { t, tf, getLang } from '../i18n'
import { getSettings } from './settings-panel'
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

spClose.addEventListener('click', () => close())

export function close() {
  panel.classList.add('hidden')
}

export async function openSpotlight(npc: NPC, state: WorldState, config: AIConfig | null) {
  panel.classList.remove('hidden')
  spName.textContent = `${npc.name} · ${npc.occupation}`

  // Render static info immediately, then load the daily thought async
  spBody.innerHTML = renderStatic(npc, state)

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

function renderStatic(npc: NPC, state: WorldState): string {
  const trustGov        = npc.trust_in.government
  const compositeTrust  = Math.round((trustGov.competence + trustGov.intention) / 2 * 100)
  const alive = npc.lifecycle.is_alive

  // Marital / romance status label
  let marital: string
  if (npc.lifecycle.spouse_id !== null) {
    marital = t('sp.married') as string
  } else if (npc.lifecycle.romance_target_id !== null) {
    const target = state.npcs.find(n => n.id === npc.lifecycle.romance_target_id)
    marital = target
      ? `${t('sp.in_love')} ${target.name}`
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
    ? t('app.average') as string : t(`app.${npc.appearance.build}`) as string
  const hairLabel   = `${t('app.hair')} ${t(`hair.${npc.appearance.hair}`)}`
  const skinLabel   = `${t('skin.light')?.length ? '' : ''}${t(`skin.${npc.appearance.skin}`)}`

  // Romance section: attraction bar + compatibility (only when in courtship)
  const romanceSection = npc.lifecycle.romance_target_id !== null ? (() => {
    const target = state.npcs.find(n => n.id === npc.lifecycle.romance_target_id)
    if (!target) return ''
    const attractionPct = Math.round(Math.min(100, npc.lifecycle.romance_score ?? 0))
    const compatPct     = Math.round(coupleCompatibilityPublic(npc, target) * 100)
    const mutualLove    = target.lifecycle.romance_target_id === npc.id
    return `
    <div class="sp-section">
      <div class="sp-section-title">${t('sp.romance')}</div>
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
    </div>

    <!-- Status bars -->
    <div class="sp-section">
      <div class="sp-section-title">${t('sp.status')}</div>
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
