import type { NarrativeEntry, FeedSeverity, BreakthroughRecord } from '../types'
import { FEED_ICONS } from '../types'
import { tf } from '../i18n'

const log = document.getElementById('feed-log')!
const chronicleLog = document.getElementById('chronicle-log')!
const breakthroughLog = document.getElementById('breakthrough-log') ?? null

// ── Feed level filter ──────────────────────────────────────────────────────
type FeedFilter = 'all' | 'warning' | 'critical'
let _feedFilter: FeedFilter = 'all'

export function setFeedFilter(level: FeedFilter) {
  _feedFilter = level
  for (const child of Array.from(log.children)) {
    const el = child as HTMLElement
    if (el.id === 'feed-thinking') continue
    const sev = el.dataset.severity ?? 'info'
    el.style.display = feedShouldShow(sev as FeedSeverity) ? '' : 'none'
  }
}

function feedShouldShow(sev: FeedSeverity): boolean {
  if (_feedFilter === 'all') return true
  if (_feedFilter === 'warning') return sev === 'warning' || sev === 'critical' || sev === 'political' || sev === 'player'
  return sev === 'critical' || sev === 'player'
}

export function addFeedEntry(entry: NarrativeEntry) {
  const el = document.createElement('div')
  el.className = `feed-entry ${entry.severity}`
  el.dataset.id = entry.id
  el.dataset.severity = entry.severity

  const month = Math.ceil(entry.day / 30)
  const dayOfMonth = entry.day % 30 || 30
  const timeLabel = tf('topbar.clock', { y: entry.year, m: month, d: dayOfMonth })

  el.innerHTML = `
    <div class="feed-time">${FEED_ICONS[entry.severity] ?? '·'} ${timeLabel}</div>
    <div class="feed-text">${entry.text.replace(/\n/g, '<br>')}</div>
  `

  if (!feedShouldShow(entry.severity)) el.style.display = 'none'

  // Click → could highlight on map later
  el.addEventListener('click', () => {
    el.classList.toggle('selected')
  })

  log.prepend(el)  // newest on top

  // Cap at 200 entries
  while (log.children.length > 200) {
    log.removeChild(log.lastChild!)
  }
}

export function addFeedRaw(
  text: string,
  severity: FeedSeverity = 'info',
  year = 1,
  day = 1,
): string {
  const id = crypto.randomUUID()
  addFeedEntry({
    id,
    tick: 0,
    day,
    year,
    text,
    icon: FEED_ICONS[severity] ?? '·',
    severity,
    related_npc_ids: [],
    related_zones: [],
  })
  return id
}

/**
 * Visually censor a feed entry — strikes through its text and appends a redaction note.
 * Called after a delay to simulate government monitoring → removal order.
 */
export function censorFeedEntry(id: string, note: string): void {
  const el = log.querySelector(`[data-id="${CSS.escape(id)}"]`) as HTMLElement | null
  if (!el || el.classList.contains('press-censored')) return
  el.classList.add('press-censored')
  const textEl = el.querySelector('.feed-text') as HTMLElement | null
  if (!textEl) return
  // Wrap existing content in a struck-through span, then append the redaction note
  textEl.innerHTML = `<span class="press-censored-text">${textEl.innerHTML}</span><div class="press-censored-note">${note}</div>`
}

export function addFeedThinking(text = 'Processing...') {
  const el = document.createElement('div')
  el.className = 'feed-entry info'
  el.id = 'feed-thinking'
  el.innerHTML = `<div class="feed-text" style="color:#444;font-style:italic">${text}</div>`
  log.prepend(el)
  return () => el.remove()
}

export type ChronicleLevel = 'minor' | 'major' | 'critical'

let _chronicleFilter: ChronicleLevel = 'major'

export function setChronicleFilter(level: ChronicleLevel) {
  _chronicleFilter = level
  // Re-apply visibility to existing entries
  for (const child of Array.from(chronicleLog.children)) {
    const el = child as HTMLElement
    const entryLevel = (el.dataset.level ?? 'minor') as ChronicleLevel
    el.style.display = shouldShow(entryLevel) ? '' : 'none'
  }
}

function shouldShow(level: ChronicleLevel): boolean {
  if (_chronicleFilter === 'minor') return true
  if (_chronicleFilter === 'major') return level === 'major' || level === 'critical'
  return level === 'critical'
}

export function addChronicle(text: string, year: number, day: number, level: ChronicleLevel = 'minor') {
  const month = Math.ceil(day / 30)
  const dayOfMonth = day % 30 || 30
  const timeLabel = tf('topbar.clock', { y: year, m: month, d: dayOfMonth })

  const el = document.createElement('div')
  el.className = 'chronicle-entry'
  el.dataset.level = level
  el.dataset.year = String(year)
  el.dataset.day = String(day)
  el.innerHTML = `<span class="chronicle-time">${timeLabel}</span> ${text}`
  if (!shouldShow(level)) el.style.display = 'none'
  chronicleLog.prepend(el)

  // Cap at 100 entries
  while (chronicleLog.children.length > 100) {
    chronicleLog.removeChild(chronicleLog.lastChild!)
  }
}

export function refreshChronicleTimestamps() {
  for (const child of Array.from(chronicleLog.children)) {
    const el = child as HTMLElement
    const year = parseInt(el.dataset.year ?? '1', 10)
    const day = parseInt(el.dataset.day ?? '1', 10)
    const month = Math.ceil(day / 30)
    const dayOfMonth = day % 30 || 30
    const timeSpan = el.querySelector('.chronicle-time')
    if (timeSpan) timeSpan.textContent = tf('topbar.clock', { y: year, m: month, d: dayOfMonth })
  }
}

// ── Breakthrough Log ────────────────────────────────────────────────────────

const SOURCE_ICONS: Record<string, string> = {
  government_reform:  '🏛',
  science_discovery:  '🔬',
  god_agent:          '⚗️',
}

/**
 * Append a breakthrough record to the `#breakthrough-log` panel.
 * Shows source icon, timestamp, title, description, and the specific formula
 * expressions or constitution parameters that changed.
 */
export function addBreakthroughToLog(record: BreakthroughRecord): void {
  if (!breakthroughLog) return

  const month = Math.ceil(record.day / 30)
  const dayOfMonth = record.day % 30 || 30
  const timeLabel = tf('topbar.clock', { y: record.year, m: month, d: dayOfMonth })
  const icon = SOURCE_ICONS[record.source] ?? '📌'

  const changes: string[] = []
  if (record.formula_patches?.length) {
    for (const fp of record.formula_patches) {
      changes.push(
        `<div class="breakthrough-change">` +
        `<span class="breakthrough-key">formula: ${fp.key}</span>` +
        `<div class="breakthrough-expr breakthrough-expr-new" title="New expression">${escapeHtml(fp.new_expr)}</div>` +
        `<div class="breakthrough-expr breakthrough-expr-old" title="Previous expression"><del>${escapeHtml(fp.prev_expr)}</del></div>` +
        `</div>`,
      )
    }
  }
  if (record.constitution_patch) {
    for (const [k, v] of Object.entries(record.constitution_patch)) {
      if (v != null) {
        const sign = (v as number) >= 0 ? '+' : ''
        changes.push(
          `<div class="breakthrough-change">` +
          `<span class="breakthrough-key">${k}</span>` +
          `<span class="breakthrough-delta">${sign}${(v as number).toFixed(3)}</span>` +
          `</div>`,
        )
      }
    }
  }

  const el = document.createElement('div')
  el.className = `breakthrough-entry breakthrough-${record.source}`
  el.dataset.id = record.id
  el.innerHTML = `
    <div class="breakthrough-header">
      <span class="breakthrough-icon">${icon}</span>
      <span class="breakthrough-time">${timeLabel}</span>
      <span class="breakthrough-title">${escapeHtml(record.title)}</span>
    </div>
    <div class="breakthrough-desc">${escapeHtml(record.description)}</div>
    ${changes.length ? `<div class="breakthrough-changes">${changes.join('')}</div>` : ''}
  `.trim()

  breakthroughLog.prepend(el)

  // Cap at 50 entries
  while (breakthroughLog.children.length > 50) {
    breakthroughLog.removeChild(breakthroughLog.lastChild!)
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
