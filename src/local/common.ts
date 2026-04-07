import type { Lang } from '../i18n'

export type Localized<T> = { en: T; vi: T }

export function pick<T>(lang: Lang, v: Localized<T>): T {
  return lang === 'vi' ? v.vi : v.en
}

