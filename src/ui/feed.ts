import type { NarrativeEntry, FeedSeverity } from '../types'
import { FEED_ICONS } from '../types'
import { tf } from '../i18n'

const log = document.getElementById('feed-log')!
const chronicleLog = document.getElementById('chronicle-log')!

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
) {
  addFeedEntry({
    id: crypto.randomUUID(),
    tick: 0,
    day,
    year,
    text,
    icon: FEED_ICONS[severity] ?? '·',
    severity,
    related_npc_ids: [],
    related_zones: [],
  })
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
  el.innerHTML = `<span class="chronicle-time">${timeLabel}</span> ${text}`
  if (!shouldShow(level)) el.style.display = 'none'
  chronicleLog.prepend(el)

  // Cap at 100 entries
  while (chronicleLog.children.length > 100) {
    chronicleLog.removeChild(chronicleLog.lastChild!)
  }
}
