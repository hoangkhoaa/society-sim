import type { ConfirmOptions } from '../types'
import { t, tf } from '../i18n'

const overlay    = document.getElementById('modal-overlay')!
const modalBox   = document.getElementById('modal-box')!
const title      = document.getElementById('modal-title')!
const body       = document.getElementById('modal-body')!
const btnConfirm = document.getElementById('modal-confirm')!
const btnCancel  = document.getElementById('modal-cancel')!
const modalActs  = document.getElementById('modal-actions')!

export interface PolicyDisplayCard {
  label: string
  name: string
  desc: string
  effects: string
  severity: 'important' | 'critical'
}

export function showConfirm(opts: ConfirmOptions) {
  title.textContent = opts.title
  body.innerHTML = opts.body
  overlay.classList.remove('hidden')
  btnCancel.classList.remove('hidden')

  const cleanup = () => {
    overlay.classList.add('hidden')
    btnConfirm.replaceWith(btnConfirm.cloneNode(true))
    btnCancel.replaceWith(btnCancel.cloneNode(true))
    document.getElementById('modal-cancel')!.classList.remove('hidden')
  }

  document.getElementById('modal-confirm')!.addEventListener('click', () => {
    cleanup()
    opts.onConfirm()
  }, { once: true })

  document.getElementById('modal-cancel')!.addEventListener('click', () => {
    cleanup()
    opts.onCancel?.()
  }, { once: true })
}

/**
 * Shows two policy option cards and returns the index (0 or 1) the player chose.
 * Auto-selects 0 after 20 seconds if no input, or if another modal is already open.
 */
export function showPolicyChoice(
  cardA: PolicyDisplayCard,
  cardB: PolicyDisplayCard,
  onPause?: () => void,
  onResume?: () => void,
): Promise<0 | 1> {
  // If overlay already in use, auto-select option A without blocking
  if (!overlay.classList.contains('hidden')) return Promise.resolve(0)

  return new Promise(resolve => {
    const uid = `pcd-${Date.now()}`
    title.textContent = t('modal.policy_title') as string
    body.innerHTML = `
      <div class="policy-countdown">${tf('modal.policy_countdown', { s: '<span id="' + uid + '">20</span>' })}</div>
      <div class="policy-cards">
        ${renderPolicyCard(cardA, 'a', uid)}
        ${renderPolicyCard(cardB, 'b', uid)}
      </div>
    `
    modalActs.style.display = 'none'
    modalBox.classList.add('policy-mode')
    overlay.classList.remove('hidden')
    onPause?.()

    let done = false
    let remaining = 20

    const cleanup = (idx: 0 | 1) => {
      if (done) return
      done = true
      clearInterval(timer)
      modalActs.style.display = ''
      modalBox.classList.remove('policy-mode')
      overlay.classList.add('hidden')
      // Clone buttons to clear any stale listeners from showConfirm/showInfo
      btnConfirm.replaceWith(btnConfirm.cloneNode(true))
      btnCancel.replaceWith(btnCancel.cloneNode(true))
      document.getElementById('modal-cancel')!.classList.remove('hidden')
      onResume?.()
      resolve(idx)
    }

    document.getElementById(`${uid}-btn-a`)?.addEventListener('click', () => cleanup(0), { once: true })
    document.getElementById(`${uid}-btn-b`)?.addEventListener('click', () => cleanup(1), { once: true })

    const timer = setInterval(() => {
      remaining--
      const el = document.getElementById(uid)
      if (el) el.textContent = `${remaining}`
      if (remaining <= 0) cleanup(0)
    }, 1000)
  })
}

function renderPolicyCard(card: PolicyDisplayCard, slot: 'a' | 'b', uid: string): string {
  const btnLabel = slot === 'a' ? t('modal.policy_btn_a') as string : t('modal.policy_btn_b') as string
  const btnClass = 'btn-primary'
  const criticalBadge = card.severity === 'critical' ? '<div class="policy-card-badge">⚠ CRITICAL</div>' : ''
  return `
    <div class="policy-card ${card.severity}">
      ${criticalBadge}
      <div class="policy-card-label">${card.label}</div>
      <div class="policy-card-name">${card.name}</div>
      <div class="policy-card-desc">${card.desc}</div>
      <div class="policy-card-effects">${card.effects}</div>
      <button id="${uid}-btn-${slot}" class="${btnClass}" style="width:100%;font-size:11px;padding:5px 0">${btnLabel}</button>
    </div>
  `
}

export function showInfo(titleText: string, bodyHtml: string) {
  title.textContent = titleText
  body.innerHTML = bodyHtml
  btnCancel.classList.add('hidden')
  overlay.classList.remove('hidden')

  const confirmBtn = document.getElementById('modal-confirm')!
  const cleanup = () => {
    overlay.classList.add('hidden')
    confirmBtn.replaceWith(confirmBtn.cloneNode(true))
    document.getElementById('modal-cancel')!.classList.remove('hidden')
  }

  document.getElementById('modal-confirm')!.addEventListener('click', () => cleanup(), { once: true })
}
