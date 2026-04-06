import type { ConfirmOptions } from '../types'

const overlay = document.getElementById('modal-overlay')!
const title = document.getElementById('modal-title')!
const body = document.getElementById('modal-body')!
const btnConfirm = document.getElementById('modal-confirm')!
const btnCancel = document.getElementById('modal-cancel')!

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
