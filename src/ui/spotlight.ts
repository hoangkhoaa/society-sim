import type { NPC, WorldState, AIConfig } from '../types'
import { generateNPCThought } from '../ai/god-agent'
import { t, getLang } from '../i18n'

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

  if (!config) {
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
  const vi = getLang() === 'vi'
  const lines: string[] = []

  if (npc.legendary) {
    lines.push(vi
      ? `⭐ <em>${npc.name} được ghi nhớ như một nhân vật huyền thoại của xã hội này.</em>`
      : `⭐ <em>${npc.name} is remembered as a legendary figure of this society.</em>`)
  }
  if (npc.faction_id !== null) {
    const faction = state.factions.find(f => f.id === npc.faction_id)
    if (faction) lines.push(vi
      ? `Thuộc phe <strong>${faction.name}</strong> (${faction.dominant_value}).`
      : `Aligned with the <strong>${faction.name}</strong> faction (${faction.dominant_value}).`)
  }
  if (npc.lifecycle.spouse_id !== null) {
    const spouse = state.npcs.find(n => n.id === npc.lifecycle.spouse_id)
    if (spouse) {
      lines.push(vi
        ? `Đã kết hôn với ${spouse.name}, làm nghề ${spouse.occupation.toLowerCase()}.`
        : `Married to ${spouse.name}, a ${spouse.occupation.toLowerCase()}.`)

      // Compatibility with spouse
      const compat = Math.round(coupleCompatibilityPublic(npc, spouse) * 100)
      lines.push(vi
        ? `Độ tương hợp với vợ/chồng: <strong>${compat}%</strong>${compat < 40 ? ' — mối quan hệ có nguy cơ rạn nứt.' : ''}`
        : `Compatibility with spouse: <strong>${compat}%</strong>${compat < 40 ? ' — the relationship is under strain.' : ''}`)
    }
  } else if (npc.lifecycle.romance_target_id !== null) {
    const target = state.npcs.find(n => n.id === npc.lifecycle.romance_target_id)
    if (target) lines.push(vi
      ? `❤ Đang có tình cảm với ${target.name} (độ hấp dẫn: ${Math.round(npc.lifecycle.romance_score ?? 0)}%).`
      : `❤ Has feelings for ${target.name} (attraction: ${Math.round(npc.lifecycle.romance_score ?? 0)}%).`)
  } else if ((npc.lifecycle.heartbreak_cooldown ?? 0) > 0) {
    const days = Math.ceil((npc.lifecycle.heartbreak_cooldown ?? 0) / 24)
    lines.push(vi
      ? `💔 Đang đau khổ sau chia tay — cần thêm ${days} ngày để hồi phục.`
      : `💔 Heartbroken — needs ${days} more days to heal.`)
  }
  if (npc.lifecycle.children_ids.length > 0) {
    const n = npc.lifecycle.children_ids.length
    lines.push(vi
      ? `Có ${n} người con.`
      : `Parent of ${n} child${n > 1 ? 'ren' : ''}.`)
  }
  if (npc.criminal_record) lines.push(vi
    ? `Có tiền án — không được tin tưởng ở một số giới.`
    : `Has a criminal record — trust runs thin in some circles.`)
  if (npc.debt > 0) {
    const creditor = state.npcs.find(n => n.id === npc.debt_to)
    lines.push(vi
      ? `Đang mang khoản nợ ${npc.debt.toFixed(0)} đồng${creditor ? ` với ${creditor.name}` : ''}.`
      : `Carries a debt of ${npc.debt.toFixed(0)} coins${creditor ? ` owed to ${creditor.name}` : ''}.`)
  }
  // Notable memories
  const heavy = npc.memory.filter(m => Math.abs(m.emotional_weight) > 30).slice(0, 2)
  for (const mem of heavy) {
    if (mem.type === 'loss') lines.push(vi
      ? `Từng chịu mất mát lớn, vết thương vẫn chưa lành.`
      : `Suffered a significant loss that still weighs on them.`)
    else if (mem.type === 'windfall') lines.push(vi
      ? `Từng gặp may mắn bất ngờ đổi thay vận số.`
      : `Once experienced an unexpected windfall that changed their fortunes.`)
    else if (mem.type === 'helped') lines.push(vi
      ? `Từng được giúp đỡ trong lúc khốn khó — điều đó vẫn còn in đậm trong tâm trí.`
      : `Was helped by someone in a moment of great need — they remember it well.`)
    else if (mem.type === 'trust_broken') lines.push(vi
      ? `Từng bị phản bội, để lại vết thương lòng khó xóa.`
      : `Their trust was betrayed in the past, leaving a lasting mark.`)
    else if (mem.type === 'crisis') lines.push(vi
      ? `Đã sống sót qua một cuộc khủng hoảng và không còn như xưa nữa.`
      : `Survived a crisis that left them changed.`)
  }
  if (npc.wealth > 5000) lines.push(vi
    ? `Đã tích lũy khối tài sản đáng kể (${npc.wealth.toFixed(0)} đồng tiền).`
    : `Has accumulated considerable wealth (${npc.wealth.toFixed(0)} coins).`)
  else if (npc.wealth < 50 && npc.age > 30) lines.push(vi
    ? `Sống trong nghèo khó, vật lộn từng ngày.`
    : `Lives in poverty, struggling to get by.`)

  if (lines.length === 0) return ''
  const title = vi ? 'Tiểu sử' : 'Life Story'
  return `
    <div class="sp-section">
      <div class="sp-section-title">${title}</div>
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
      ${mutualLove ? `<div class="sp-row" style="color:#e87ca0">💑 Mutual feelings</div>` : ''}
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
        <span class="sp-label">Healing</span>
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
      ${(npc.burnout_ticks ?? 0) >= 480 ? `<div class="sp-row" style="color:#e24b4b;font-weight:bold">${t('sp.burnout')}</div>` : ''}
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

    ${romanceSection}
    ${heartbreakSection}

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
