// ── Free Press — Headline Generation System ─────────────────────────────────
//
// Periodically (every 5 sim-days) generates "newspaper" headlines that describe
// aggregate NPC behavior and societal trends.  Two modes:
//   1. Template mode (default): picks from ~100 pre-written templates keyed
//      to macro conditions + NPC behavioral signals.
//   2. AI mode: when runPressCycle receives AIConfig, calls the LLM for richer headlines.
//
// Headlines feed into the main feed & chronicle and are also passed as context
// to the Government cycle so it can "read the press" before deciding policy.

import type { WorldState, AIConfig, Rumor } from '../types'
import { addFeedRaw, addChronicle, censorFeedEntry } from '../ui/feed'
import { callAI } from '../ai/provider'
import { getLang, type Lang } from '../i18n'
import {
  pressSystemPrompt,
  pressSnapshotPrompt,
  pressShouldUseAI,
  type PressScan,
  PRESS_TEMPLATES,
  resolvePressText,
  pressRumorTrustDown,
  pressRumorFoodFear,
  pressRumorHoardingGrievance,
  pressRumorEpidemicFear,
  scandalRumorContent,
  scandalHeadline,
  redactionNoteText,
  censorshipLeakContent,
  suppressedLabel,
  censorshipEscapedText,
} from '../local/press'
import { getRegimeProfile, type OccVariant } from './regime-config'
import { clamp } from './constitution'

// ── Snapshot of societal signals for condition matching ─────────────────────

function scanSociety(state: WorldState): PressScan {
  const living = state.npcs.filter(n => n.lifecycle.is_alive)
  const n = living.length || 1
  const m = state.macro
  const sick       = living.filter(n => n.sick).length
  const fleeing    = living.filter(n => n.action_state === 'fleeing').length
  const organizing = living.filter(n => n.action_state === 'organizing').length
  const confront   = living.filter(n => n.action_state === 'confront').length
  const resting    = living.filter(n => n.action_state === 'resting').length

  const merchants = living.filter(n => n.role === 'merchant')
  const farmers   = living.filter(n => n.role === 'farmer')

  return {
    food: m.food,
    stability: m.stability,
    trust: m.trust,
    gini: m.gini,
    pressure: m.political_pressure,
    resources: m.natural_resources,
    energy: m.energy,
    literacy: m.literacy,
    population: living.length,
    sickPct:       sick / n * 100,
    fleeingPct:    fleeing / n * 100,
    organizingPct: organizing / n * 100,
    confrontPct:   confront / n * 100,
    restingPct:    resting / n * 100,
    avgGrievance:  living.reduce((s, x) => s + x.grievance, 0) / n,
    avgStress:     living.reduce((s, x) => s + x.stress, 0) / n,
    avgHappiness:  living.reduce((s, x) => s + x.happiness, 0) / n,
    avgHunger:     living.reduce((s, x) => s + x.hunger, 0) / n,
    epidemicActive: state.active_events.some(e => e.type === 'epidemic'),
    threatActive:   state.active_events.some(e => e.type === 'external_threat'),
    blockadeActive: state.active_events.some(e => e.type === 'blockade'),
    droughtActive:  state.active_events.some(e => e.type === 'drought'),
    isWinter:       state.day > 270 || state.day <= 90,
    merchantAvgWealth: merchants.length ? merchants.reduce((s, x) => s + x.wealth, 0) / merchants.length : 0,
    farmerAvgWealth:   farmers.length   ? farmers.reduce((s, x) => s + x.wealth, 0) / farmers.length     : 0,
  }
}

// ── Template Headline Pool ──────────────────────────────────────────────────
// Template pool is defined in local/press.ts (PRESS_TEMPLATES).


// ── Template selection ──────────────────────────────────────────────────────

function selectHeadlines(scan: PressScan, maxCount: number): { text: string; severity: 'info' | 'warning' | 'critical' }[] {
  const lang = getLang()
  const matching = PRESS_TEMPLATES.filter(t => t.cond(scan))
  const critical = matching.filter(t => t.severity === 'critical').sort(() => Math.random() - 0.5)
  const warning  = matching.filter(t => t.severity === 'warning').sort(() => Math.random() - 0.5)
  const info     = matching.filter(t => t.severity === 'info').sort(() => Math.random() - 0.5)
  const picked: { text: string; severity: 'info' | 'warning' | 'critical' }[] = []
  for (const pool of [critical, warning, info]) {
    for (const t of pool) {
      if (picked.length >= maxCount) break
      picked.push({ text: resolvePressText(lang, t, scan), severity: t.severity })
    }
  }
  return picked
}

// ── AI headline generation ──────────────────────────────────────────────────

async function generateAIHeadlines(state: WorldState, scan: PressScan, config: AIConfig): Promise<Array<{ headline: string; body: string; severity: string }>> {
  const lang = getLang()
  const raw = await callAI(config, pressSystemPrompt(lang), pressSnapshotPrompt(state, scan))
  const jsonMatch = raw.match(/\[[\s\S]*\]/)
  if (!jsonMatch) return []
  return JSON.parse(jsonMatch[0])
}

// ── Press-triggered rumor cascade ──────────────────────────────────────────
// Critical headlines automatically seed a matching rumor into the world.
// Max one new rumor per press cycle; skipped if same effect already active.

function spawnPressRumor(state: WorldState, scan: PressScan, criticalCount: number): void {
  if (criticalCount === 0) return
  const lang = getLang()

  type RumorSpec = { content: string; subject: Rumor['subject']; effect: Rumor['effect'] }
  let spec: RumorSpec | null = null

  if (scan.trust < 30)         spec = pressRumorTrustDown(lang)
  else if (scan.food < 20)     spec = pressRumorFoodFear(lang)
  else if (scan.gini > 0.55)   spec = pressRumorHoardingGrievance(lang)
  else if (scan.epidemicActive) spec = pressRumorEpidemicFear(lang)

  if (!spec) return
  if (state.rumors.some(r => r.effect === spec!.effect && r.expires_tick > state.tick)) return

  state.rumors.push({
    id: `press_${state.tick}_${spec.effect}`,
    content: spec.content,
    subject: spec.subject,
    effect: spec.effect,
    reach: 15,
    born_tick: state.tick,
    expires_tick: state.tick + 15 * 24,
  })
}

// ── Investigative scandal ───────────────────────────────────────────────────
// Special breaking headline with direct mechanical effect. Fires at most once
// every 20 sim-days when trust, gini, AND political pressure are all dire.

let _lastScandalDay = -999

function checkInvestigativeScandal(
  state: WorldState,
  scan: PressScan,
): { text: string; severity: 'critical' } | null {
  if (scan.trust >= 28 || scan.gini <= 0.52 || scan.pressure <= 60) return null
  if (state.day - _lastScandalDay < 20) return null
  _lastScandalDay = state.day

  const lang = getLang()

  // Spawn a high-reach corruption rumor (if not already active at this scale)
  const alreadyHigh = state.rumors.some(r => r.effect === 'trust_down' && r.reach >= 25 && r.expires_tick > state.tick)
  if (!alreadyHigh) {
    state.rumors.push({
      id: `scandal_${state.tick}`,
      content: scandalRumorContent(lang),
      subject: 'government',
      effect: 'trust_down',
      reach: 30,
      born_tick: state.tick,
      expires_tick: state.tick + 20 * 24,
    })
  }

  return { text: scandalHeadline(lang), severity: 'critical' }
}

// ── Press Censorship ─────────────────────────────────────────────────────────
//
// After headlines are published to the feed, the regime evaluates them.
// Threatening content (critical/warning severity) may be redacted:
//   • Feed entry gets struck through with an official removal note
//   • A fraction of NPCs who "saw it first" gain dissonance + grievance
//   • A suppressed-news rumor leaks into the info_ties network
//
// The visual censor is delayed 2–6 real seconds — simulating government
// monitoring → removal order, letting the player see the headline before it vanishes.

/** Probability that a headline of this severity gets censored for the given regime. */
function censorProbability(severity: 'info' | 'warning' | 'critical', censorshipProb: number, variant: OccVariant): number {
  if (censorshipProb < 0.05) return 0          // free press — no censorship
  // Warlord / collective regimes also suppress neutral-seeming 'info' items
  // that could undermine the official narrative
  if (severity === 'info') {
    if (variant === 'warlord')   return censorshipProb * 0.22
    if (variant === 'collective') return censorshipProb * 0.10
    return 0                                   // free/moderate regimes: neutral news left alone
  }
  let base: number
  if (severity === 'warning') {
    // Warning items should be filtered selectively, not wiped out wholesale.
    if (variant === 'warlord')         base = Math.min(0.64, censorshipProb * 0.68)
    else if (variant === 'collective') base = Math.min(0.52, censorshipProb * 0.54)
    else if (variant === 'feudal')     base = censorshipProb * 0.40
    else if (variant === 'theocracy')  base = censorshipProb * 0.44
    else base = censorshipProb * 0.30               // default / capitalist / technocracy
  } else {
    // Critical items still attract censorship, but should leave visible room for uncensored stories.
    if (variant === 'warlord')         base = Math.min(0.74, censorshipProb * 0.86)
    else if (variant === 'collective') base = Math.min(0.61, censorshipProb * 0.72)
    else if (variant === 'feudal')     base = Math.min(0.52, censorshipProb * 0.58)
    else if (variant === 'theocracy')  base = Math.min(0.52, censorshipProb * 0.58)
    else base = Math.min(0.48, censorshipProb * 0.44) // default / capitalist / technocracy
  }
  // Per-article luck jitter: ±25% of the base rate (simulates bureaucratic efficiency variance)
  const jitter = (Math.random() - 0.5) * 0.25 * base
  return clamp(base + jitter, 0, 0.98)
}

/**
 * Press censorship is a side feature, so it should not trigger every cycle.
 * Authoritarian regimes still see it more often, but many cycles remain uncensored.
 */
function shouldRunCensorshipThisCycle(censorshipProb: number): boolean {
  const cycleChance = clamp(0.08 + censorshipProb * 0.42, 0, 0.50)
  return Math.random() < cycleChance
}

// redactionNoteText(lang, censorshipProb, variant) is imported from local/press

/**
 * Probability that a censorship attempt fails because the story has already
 * leaked too widely by the time the takedown order arrives.
 * Factors: open information networks, high political pressure, critical severity,
 * and a base random chance representing "viral spread before takedown."
 */
function leakEscapeProbability(
  severity: 'info' | 'warning' | 'critical',
  infoSpreadMult: number,
  politicalPressure: number,
  variant: OccVariant,
): number {
  // Base escape chance — critical stories spread faster and are harder to kill
  let base = severity === 'critical' ? 0.20 : severity === 'warning' ? 0.12 : 0.06
  // Open information networks let news spread faster than censors can act
  base += infoSpreadMult * 0.15
  // Political pressure = more people paying attention / sharing
  base += Math.max(0, politicalPressure - 40) / 100 * 0.20
  // Authoritarian regimes invest more in rapid suppression — harder to escape
  if (variant === 'warlord')         base *= 0.50
  else if (variant === 'collective') base *= 0.60
  else if (variant === 'feudal')     base *= 0.65
  else if (variant === 'theocracy')  base *= 0.70
  return clamp(base, 0, 0.70)
}

/** Apply censorship effect: visual redaction + NPC leak + rumor. */
function applyCensorship(
  state: WorldState,
  entryId: string,
  headline: { text: string; severity: 'info' | 'warning' | 'critical' },
  censorshipProb: number,
  variant: OccVariant,
  lang: Lang,
): void {
  const restrictions = getRegimeProfile(state.constitution).simRestrictions

  // Delay visual censorship 2–6 real seconds (government monitoring → takedown order)
  const delayMs = 2000 + Math.random() * 4000
  setTimeout(() => {
    // ── "Too late" check: did the story escape before censors arrived? ───────
    const escapeProbNow = leakEscapeProbability(
      headline.severity,
      restrictions.info_spread_mult,
      state.macro.political_pressure,
      variant,
    )
    if (Math.random() < escapeProbNow) {
      // Story spread too far — censorship fails; mark with escape note instead
      const escapeNote = censorshipEscapedText(lang, variant)
      censorFeedEntry(entryId, escapeNote)
      // Boost NPC effects: seeing a failed suppression fuels trust collapse
      const living = state.npcs.filter(n => n.lifecycle.is_alive)
      const witnessCount = Math.max(1, Math.round(living.length * 0.10))
      const witnesses = [...living]
        .sort((a, b) => b.influence_score - a.influence_score)
        .slice(0, witnessCount)
      for (const npc of witnesses) {
        npc.dissonance_acc = clamp(npc.dissonance_acc + 6, 0, 100)
        npc.grievance      = clamp(npc.grievance + 5, 0, 100)
        // Authority loses credibility when suppression visibly fails
        npc.worldview.authority_trust = clamp(npc.worldview.authority_trust - 0.04, 0, 1)
      }
      return
    }

    // Censorship succeeds — apply normal redaction
    const note = redactionNoteText(lang, censorshipProb, variant)
    censorFeedEntry(entryId, note)
  }, delayMs)

  // NPCs who "witnessed" the article before removal: opinion leaders + info-hub NPCs
  const living = state.npcs.filter(n => n.lifecycle.is_alive)
  const witnessCount = Math.max(1, Math.round(living.length * 0.07))
  const witnesses = [...living]
    .sort((a, b) => b.influence_score + b.info_ties.length * 0.01 - a.influence_score - a.info_ties.length * 0.01)
    .slice(0, witnessCount)

  for (const npc of witnesses) {
    // Seeing news get erased breeds distrust and cognitive dissonance
    npc.dissonance_acc = clamp(npc.dissonance_acc + 10, 0, 100)
    npc.grievance      = clamp(npc.grievance + 3, 0, 100)
  }

  // Seed a low-reach "suppressed article" leak rumor that spreads via whisper network
  if (headline.severity === 'critical') {
    const alreadyLeaking = state.rumors.some(
      r => r.id.startsWith('press_leak_') && r.expires_tick > state.tick,
    )
    if (!alreadyLeaking) {
      state.rumors.push({
        id: `press_leak_${state.tick}`,
        content: censorshipLeakContent(lang),
        subject: 'government',
        effect: 'trust_down',
        reach: 8,   // starts small — grows only via info_ties whisper network
        born_tick: state.tick,
        expires_tick: state.tick + 10 * 24,
      })
    }
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

let _lastPressDay = -1
let _pressBusy = false

/** Most recent press headlines — available for government to read. */
let _latestHeadlines: string[] = []
export function getLatestHeadlines(): string[] { return _latestHeadlines }

export function resetPressRuntimeState(): void {
  _lastPressDay = -1
  _pressBusy = false
  _latestHeadlines = []
  _lastScandalDay = -999
}

export async function runPressCycle(
  state: WorldState,
  config: AIConfig | null,
): Promise<void> {
  if (_pressBusy) return
  _pressBusy = true

  try {
    const scan = scanSociety(state)
    const headlines: Array<{ text: string; severity: 'info' | 'warning' | 'critical' }> = []

    const useAI = pressShouldUseAI(config)

    if (useAI) {
      try {
        const aiResults = await generateAIHeadlines(state, scan, config!)
        for (const r of aiResults.slice(0, 4)) {
          const sev = (r.severity === 'critical' || r.severity === 'warning' || r.severity === 'info') ? r.severity : 'info'
          headlines.push({ text: `📰 ${r.headline} — ${r.body}`, severity: sev as 'info' | 'warning' | 'critical' })
        }
      } catch {
        // AI failed — fall through to template mode
      }
    }

    // Template fallback (or primary if not unlimited mode)
    if (headlines.length === 0) {
      const picked = selectHeadlines(scan, 3)
      for (const p of picked) {
        headlines.push({ text: `📰 ${p.text}`, severity: p.severity })
      }
    }

    // Investigative scandal: inserts a special breaking headline if conditions met
    const scandal = checkInvestigativeScandal(state, scan)
    if (scandal) headlines.unshift({ text: scandal.text, severity: scandal.severity })

    // ── Censorship evaluation ───────────────────────────────────────────────
    const regimeProfile = getRegimeProfile(state.constitution)
    const restrictions  = regimeProfile.simRestrictions
    const variant       = regimeProfile.variant
    const lang          = getLang()
    const cProb         = restrictions.censorship_prob
    const censorThisCycle = shouldRunCensorshipThisCycle(cProb)

    // Decide censorship per headline BEFORE publishing so we can annotate the chronicle
    type PublishedEntry = {
      h:           { text: string; severity: 'info' | 'warning' | 'critical' }
      entryId:     string
      willCensor:  boolean
    }
    const published: PublishedEntry[] = []

    // Emit to feed + chronicle
    _latestHeadlines = []
    for (const h of headlines) {
      const feedSev = h.severity === 'critical' ? 'critical' : h.severity === 'warning' ? 'warning' : 'info'
      const entryId = addFeedRaw(h.text, feedSev, state.year, state.day)

      const willCensor = censorThisCycle
        && Math.random() < censorProbability(h.severity, cProb, variant)

      // Chronicle is the permanent historical record — marks censored articles
      const chronicleText = willCensor
        ? h.text + suppressedLabel(lang)
        : h.text
      addChronicle(chronicleText, state.year, state.day, h.severity === 'critical' ? 'critical' : 'major')

      _latestHeadlines.push(h.text)
      published.push({ h, entryId, willCensor })
    }

    // Apply censorship with delay (visual takedown) + NPC effects
    for (const { h, entryId, willCensor } of published) {
      if (willCensor) applyCensorship(state, entryId, h, cProb, variant, lang)
    }

    // Spawn a rumor from critical headlines
    const criticalCount = headlines.filter(h => h.severity === 'critical').length
    spawnPressRumor(state, scan, criticalCount)

    // ── Corruption whistleblower scandals ──────────────────────────────────
    // If any institution has high corruption AND the press is relatively free,
    // there is a 10% chance per press cycle that a scandal headline fires.
    const pressFreedom = 1 - cProb   // derive press freedom from censorship probability
    if (pressFreedom > 0.3) {
      for (const inst of state.institutions) {
        if (inst.corruption_level > 0.5 && Math.random() < 0.10) {
          const scandalText = `SCANDAL: Sources allege widespread corruption within the ${inst.name} — officials accused of diverting resources for personal gain.`
          addChronicle(scandalText, state.year, state.day, 'critical')
          addFeedRaw(`📰 ${scandalText}`, 'critical', state.year, state.day)

          // Seed a trust-down rumor targeting the corrupt institution
          const alreadyScandalRumor = state.rumors.some(
            r => r.id.startsWith(`corruption_${inst.id}`) && r.expires_tick > state.tick,
          )
          if (!alreadyScandalRumor) {
            state.rumors.push({
              id: `corruption_${inst.id}_${state.tick}`,
              content: `Witnesses report officials from the ${inst.name} diverting public funds for personal enrichment.`,
              subject: inst.id as 'government' | 'guard' | 'market' | 'community',
              effect: 'trust_down',
              reach: 20,
              born_tick: state.tick,
              expires_tick: state.tick + 15 * 24,
            })
          }

          // Exposure forces some cleanup — corruption slightly reduced
          inst.corruption_level = Math.max(inst.corruption_level - 0.05, 0)
        }
      }
    }
  } finally {
    _pressBusy = false
  }
}

/** Should be called from the sim loop. Returns true if a press cycle ran this tick. */
export function checkPressTrigger(state: WorldState, config: AIConfig | null): boolean {
  // No press when society has collapsed or population is too low to support media
  if (state.collapse_phase !== 'normal') return false
  const livingCount = state.npcs.filter(n => n.lifecycle.is_alive).length
  if (livingCount < 20) return false

  const pressPeriod = Math.floor(state.day / 5)
  if (pressPeriod === _lastPressDay) return false
  if (state.day < 5) return false
  _lastPressDay = pressPeriod
  void runPressCycle(state, config)
  return true
}
