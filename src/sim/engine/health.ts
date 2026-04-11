import type { WorldState } from '../../types'
import { clamp } from '../constitution'
import { computeProductivity } from '../npc'
import { addFeedRaw, addChronicle } from '../../ui/feed'
import { t, tf } from '../../i18n'

// ── Epidemic Intelligence ─────────────────────────────────────────────────────
// When an epidemic is active scholars work toward a cure (accumulating cure_progress).
// Guards can quarantine epidemic zones (blocking NPC movement).
// Cure breakthrough: epidemic intensity halved and quarantine lifted.

const cureProgress = { value: 0, lastResetTick: -1, epidemicId: '' }

export function checkEpidemicIntelligence(state: WorldState): void {
  const epidemic = state.active_events.find(e => e.type === 'epidemic')

  if (!epidemic) {
    // No epidemic: lift all quarantines and reset cure progress
    if (state.quarantine_zones.length > 0) {
      state.quarantine_zones = []
    }
    cureProgress.value = 0
    cureProgress.lastResetTick = -1
    cureProgress.epidemicId = ''
    return
  }

  // Reset cure counter when a new epidemic starts (detected by epidemic ID change)
  if (cureProgress.epidemicId !== epidemic.id) {
    cureProgress.value = 0
    cureProgress.lastResetTick = state.tick
    cureProgress.epidemicId = epidemic.id
  }

  // Scholars in scholar_quarter and healthcare workers in clinic_district accumulate cure progress each day
  const researchers = state.npcs.filter(n =>
    n.lifecycle.is_alive && (
      (n.role === 'scholar' && n.zone === 'scholar_quarter') ||
      (n.role === 'healthcare' && n.zone === 'clinic_district')
    ),
  )
  let dailyCureGain = researchers.reduce((s, n) => s + computeProductivity(n, state), 0) * 0.8
  // Public health: sanitation > 60 accelerates cure progress by 20%
  if ((state.public_health?.sanitation ?? 0) > 60) {
    dailyCureGain *= 1.20
  }
  cureProgress.value += dailyCureGain

  // Quarantine: guards enforce zone lockdown on epidemic zones after 3 days
  const guardInst = state.institutions.find(i => i.id === 'guard')
  if ((guardInst?.power ?? 0) > 0.40 && epidemic.elapsed_ticks > 72) {
    const newQuarantines = epidemic.zones.filter(z => !state.quarantine_zones.includes(z))
    if (newQuarantines.length > 0) {
      state.quarantine_zones = [...state.quarantine_zones, ...newQuarantines]
      const zoneLabels = newQuarantines.map(z => t(`zone.${z}`) as string).join(', ')
      const text = tf('engine.epidemic_quarantine', { zones: zoneLabels }) as string
      addChronicle(text, state.year, state.day, 'major')
      addFeedRaw(text, 'warning', state.year, state.day)
    }
  }

  // Cure breakthrough: when researchers have accumulated enough progress
  const cureThreshold = 200 + epidemic.intensity * 300  // 200–500 research units
  if (cureProgress.value >= cureThreshold) {
    epidemic.intensity = clamp(epidemic.intensity * 0.50, 0.01, 1)
    epidemic.effects_per_tick.stress_delta  *= 0.50
    epidemic.effects_per_tick.displacement_chance *= 0.50
    cureProgress.value = 0

    const topResearcher = researchers.sort((a, b) => b.influence_score - a.influence_score)[0]
    const heroName   = topResearcher?.name ?? (t('engine.scholars_collective') as string)
    const text = tf('engine.cure_breakthrough', { name: heroName }) as string
    addChronicle(text, state.year, state.day, 'critical')
    addFeedRaw(text, 'info', state.year, state.day)

    if (topResearcher) topResearcher.legendary = true

    // Lift quarantines after cure
    state.quarantine_zones = []
  }
}

// ── Public Health Infrastructure ──────────────────────────────────────────────
// Runs daily. Sanitation decays slowly unless maintained by scholars.
// Hospital capacity is unlocked by health_investment policy spending and expires after 30 days.
// disease_resistance is derived from sanitation and reduces sickness probability.

export function updatePublicHealth(state: WorldState): void {
  const ph = state.public_health
  if (!ph) return

  // Sanitation decays 0.1 per day (0–100 scale)
  ph.sanitation = clamp(ph.sanitation - 0.1, 0, 100)

  // Scholar and healthcare output boosts sanitation: productive workers in their zones contribute
  const sanitationWorkers = state.npcs.filter(n =>
    n.lifecycle.is_alive && (
      (n.role === 'scholar' && n.zone === 'scholar_quarter') ||
      (n.role === 'healthcare' && n.zone === 'clinic_district')
    ),
  )
  const scholarBoost = sanitationWorkers.reduce((s, n) => s + computeProductivity(n, state), 0) * 0.02
  ph.sanitation = clamp(ph.sanitation + scholarBoost, 0, 100)

  // Hospital capacity expires after 30 sim-days (720 ticks) since last funding
  if (ph.hospital_capacity > 0 && ph.funded_tick > 0) {
    const HOSPITAL_BOOST_DURATION = 30 * 24  // 30 sim-days in ticks
    if (state.tick - ph.funded_tick >= HOSPITAL_BOOST_DURATION) {
      ph.hospital_capacity = 0
      const text = t('engine.public_health.hospital_expired') as string
      addChronicle(text, state.year, state.day, 'minor')
      addFeedRaw(text, 'warning', state.year, state.day)
    }
  }

  // disease_resistance is derived from sanitation: full sanitation (100) = 1.0 resistance
  ph.disease_resistance = ph.sanitation / 100
}
