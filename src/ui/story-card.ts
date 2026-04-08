// ── Story Card ──────────────────────────────────────────────────────────────
// A cinematic card that slides up from the bottom of the map when a narrative
// event fires. Visible for 8 seconds then fades out automatically.
// Only shown for 'major' and 'critical' severity stories.

import { t } from '../i18n'

let _activeCard: HTMLElement | null = null
let _cardTimeout: ReturnType<typeof setTimeout> | null = null

export function showStoryCard(
  text: string,
  icon: string,
  severity: 'minor' | 'major' | 'critical',
): void {
  if (severity === 'minor') return

  // Dismiss any existing card immediately
  if (_activeCard) {
    _activeCard.remove()
    _activeCard = null
    if (_cardTimeout !== null) { clearTimeout(_cardTimeout); _cardTimeout = null }
  }

  const container = document.getElementById('map-container')
  if (!container) return

  const card = document.createElement('div')
  card.className = `story-card ${severity}`

  const iconEl = document.createElement('span')
  iconEl.className = 'story-card-icon'
  iconEl.textContent = icon

  const labelEl = document.createElement('div')
  labelEl.className = 'story-card-label'
  labelEl.textContent = severity === 'critical' ? t('story.critical') as string : t('story.chronicle') as string

  const textEl = document.createElement('p')
  textEl.textContent = text.length > 160 ? text.slice(0, 157) + '…' : text

  card.append(iconEl, labelEl, textEl)
  container.appendChild(card)
  _activeCard = card

  // Auto-dismiss after 8 seconds
  _cardTimeout = setTimeout(() => {
    if (_activeCard === card) {
      card.classList.add('fade-out')
      card.addEventListener('animationend', () => card.remove(), { once: true })
      _activeCard = null
      _cardTimeout = null
    }
  }, 8000)
}
