/**
 * Day-based milestones shown as toasts and recorded in `WorldState.stats.achieved_days`.
 */

export interface AchievementDef {
  /** Stable id for debugging / future persistence. */
  id: string
  /** Total sim-days elapsed (year-1)*360 + day must reach this. */
  dayThreshold: number
  titleKey: string
  descKey: string
}

export const ACHIEVEMENT_DEFINITIONS: AchievementDef[] = [
  { id: 'day100', dayThreshold: 100,       titleKey: 'achievement.day100.title', descKey: 'achievement.day100.desc' },
  { id: 'year1',  dayThreshold: 360,       titleKey: 'achievement.year1.title',  descKey: 'achievement.year1.desc'  },
  { id: 'year3',  dayThreshold: 360 * 3,   titleKey: 'achievement.year3.title',  descKey: 'achievement.year3.desc'  },
  { id: 'year5',  dayThreshold: 360 * 5,   titleKey: 'achievement.year5.title',  descKey: 'achievement.year5.desc'  },
  { id: 'year10', dayThreshold: 360 * 10,  titleKey: 'achievement.year10.title', descKey: 'achievement.year10.desc' },
]
