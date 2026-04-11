/**
 * Map canvas layout, NPC motion, ties, and weather caps (`ui/map.ts`).
 */

/** Fraction of canvas inset around the playable town rect. */
export const MAP_VIEWPORT_PADDING = 0.1

/** CSS/output px blur for `background_blurred_layout` inner layer. */
export const MAP_LAYOUT_BLUR_PX = 4

/** Downsample factor for cheap blur pass (0.5 = half-res scratch buffer). */
export const MAP_BLUR_LAYER_DOWNSAMPLE = 0.5

/** Scrim alpha over underlay before blurred vectors (light theme). */
export const MAP_BLUR_UNDERLAY_SCRIM_LIGHT = 0.07

/** Scrim alpha over underlay before blurred vectors (dark theme). */
export const MAP_BLUR_UNDERLAY_SCRIM_DARK = 0.11

/** Per-action lerp speed multiplier for NPC sprite drift. */
export const MAP_NPC_ACTION_SPEED: Record<string, number> = {
  working:     0.0006,
  resting:     0,
  family:      0.0004,
  socializing: 0.0010,
  organizing:  0.0014,
  fleeing:     0.003,
  confront:    0.002,
  complying:   0.0005,
}

/** Max canvas pixels for drawing strong/direct ties. */
export const MAP_DIRECT_TIE_MAX_DRAW_PX = 120

/** Max canvas pixels for weak info ties (longer range). */
export const MAP_INFO_TIE_MAX_DRAW_PX = 280

/** Base alpha for info ties (breathing animation adds pulse). */
export const MAP_INFO_TIE_BASE_ALPHA = 0.12

export const MAP_INFO_TIE_PULSE_ALPHA = 0.10

export const MAP_MAX_RAIN_DROPS = 220

export const MAP_MAX_SNOW_FLAKES = 160

export const MAP_MAX_SMOKE_PLUMES = 28

/** Frames to skip while paused (~5 fps) unless a forced redraw is pending. */
export const MAP_PAUSED_FRAME_SKIP = 12
