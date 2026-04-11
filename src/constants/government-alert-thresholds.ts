/**
 * Macro thresholds for government “alert” lines in the AI prompt (`sim/government.ts`).
 */

export const GOVERNMENT_ALERT_THRESHOLDS = {
  food_critical:      25,
  food_warning:       38,
  stability_critical: 28,
  stability_warning:  40,
  trust_critical:     22,
  trust_warning:      32,
  pressure_critical:  72,
  pressure_warning:   58,
  resources_critical: 15,
  resources_warning:  28,
} as const

/** Labor unrest % — critical alert tier. */
export const GOVERNMENT_LABOR_UNREST_CRITICAL = 82

/** Labor unrest % — warning tier. */
export const GOVERNMENT_LABOR_UNREST_WARNING = 65
