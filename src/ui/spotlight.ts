import type { NPC, WorldState, AIConfig } from '../types'
import { generateNPCThought } from '../ai/god-agent'
import { t } from '../i18n'

const panel   = document.getElementById('spotlight')!
const spName  = document.getElementById('sp-name')!
const spBody  = document.getElementById('sp-body')!
const spClose = document.getElementById('sp-close')!

spClose.addEventListener('click', () => close())

export function close() {
  panel.classList.add('hidden')
}

export async function openSpotlight(npc: NPC, state: WorldState, config: AIConfig) {
  panel.classList.remove('hidden')
  spName.textContent = `${npc.name} · ${npc.occupation}`

  // Render static info immediately, then load the daily thought async
  spBody.innerHTML = renderStatic(npc, state)

  const thoughtEl = document.getElementById('sp-thought-text')!
  thoughtEl.textContent = t('sp.thought_loading') as string
  thoughtEl.className   = 'sp-thought loading'

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

function renderStatic(npc: NPC, _state: WorldState): string {
  const trustGov        = npc.trust_in.government
  const compositeTrust  = Math.round((trustGov.competence + trustGov.intention) / 2 * 100)
  const marital         = npc.lifecycle.spouse_id !== null
    ? t('sp.married') : t('sp.single')
  const alive = npc.lifecycle.is_alive

  const genderLabel = npc.gender === 'male' ? t('sp.male') : t('sp.female')

  // Appearance tags using i18n labels
  const heightLabel = t(`app.${npc.appearance.height}`) as string
  const buildLabel  = npc.appearance.build === 'average'
    ? t('app.average') as string : t(`app.${npc.appearance.build}`) as string
  const hairLabel   = `${t('app.hair')} ${t(`hair.${npc.appearance.hair}`)}`
  const skinLabel   = `${t('skin.light')?.length ? '' : ''}${t(`skin.${npc.appearance.skin}`)}`

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
    </div>

    <!-- Status flags -->
    ${(npc.sick || npc.criminal_record) ? `
    <div class="sp-section">
      <div class="sp-section-title">${t('sp.flags')}</div>
      ${npc.sick ? `<div class="sp-row"><span class="sp-label" style="color:#ef9f27">🤒 ${t('sp.sick')}</span><span class="sp-value">${Math.ceil(npc.sick_ticks / 24)} ${t('sp.days_remaining')}</span></div>` : ''}
      ${npc.criminal_record ? `<div class="sp-row"><span class="sp-label" style="color:#e24b4b">⚠ ${t('sp.criminal_record')}</span></div>` : ''}
    </div>` : ''}

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
