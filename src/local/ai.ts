import type { Lang } from '../i18n'
import { pick } from './common'

export function aiConfirmInitMessage(lang: Lang): string {
  return pick(lang, {
    en: 'Constitution confirmed. Initializing your society...',
    vi: 'Hiến pháp đã được xác nhận. Đang khởi tạo xã hội...',
  })
}

export function aiTokenModeBlockedMessage(lang: Lang): string {
  return pick(lang, {
    en: 'Current token mode only allows world events and consequences. Switch to level 2 or 3 to directly control NPCs.',
    vi: 'Chế độ token hiện tại chỉ cho phép tạo sự kiện và hậu quả. Hãy chuyển sang mức 2 hoặc 3 để điều khiển trực tiếp NPC.',
  })
}

export function aiParseFallbackMessage(lang: Lang): string {
  return pick(lang, {
    en: 'Could not parse AI response. Please try again.',
    vi: 'Không thể diễn giải phản hồi của AI. Hãy thử lại.',
  })
}

export function aiNpcThoughtFallback(lang: Lang, action: string, stressPct: number, happinessPct: number): string {
  return lang === 'vi'
    ? `Hôm nay mình ${action}, áp lực ${stressPct}%, tâm trạng ${happinessPct}%.`
    : `Today I am ${action}, with stress at ${stressPct}% and mood at ${happinessPct}%.`
}

