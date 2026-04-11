/**
 * Age histogram buckets for the demographics panel (`demo.age_*` i18n keys).
 */

export interface AgeGroupBucket {
  i18nKey: string
  min: number
  max: number
}

export const DEMOGRAPHICS_AGE_GROUPS: AgeGroupBucket[] = [
  { i18nKey: 'demo.age_0', min: 0,  max: 17 },
  { i18nKey: 'demo.age_1', min: 18, max: 34 },
  { i18nKey: 'demo.age_2', min: 35, max: 49 },
  { i18nKey: 'demo.age_3', min: 50, max: 69 },
  { i18nKey: 'demo.age_4', min: 70, max: 999 },
]
