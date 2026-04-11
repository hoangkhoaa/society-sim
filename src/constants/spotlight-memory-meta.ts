/**
 * Memory row icons + i18n key suffixes in the spotlight panel (`ui/spotlight.ts`).
 */

export interface SpotlightMemoryMeta {
  icon: string
  key: string
  sign: 1 | -1
}

export const SPOTLIGHT_MEMORY_TYPE_META: Record<string, SpotlightMemoryMeta> = {
  trust_broken: { icon: '🔪', key: 'betrayal',  sign: -1 },
  helped:       { icon: '🫱🏻‍🫲🏼', key: 'helped',    sign:  1 },
  harmed:       { icon: '💣', key: 'harmed',    sign: -1 },
  crisis:       { icon: '🚨', key: 'crisis',    sign: -1 },
  windfall:     { icon: '🏆', key: 'windfall',  sign:  1 },
  loss:         { icon: '🕳️', key: 'loss',      sign: -1 },
  illness:      { icon: '🦠', key: 'illness',   sign: -1 },
  crime:        { icon: '🕵️‍♂️', key: 'crime',     sign: -1 },
  accident:     { icon: '🚑', key: 'accident',  sign: -1 },
}
