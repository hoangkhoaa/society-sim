/** Build-time flags from Vite (`VITE_*`). Default public build hides optional presets. */
export function isMarxistPresetEnabled(): boolean {
  return import.meta.env.VITE_ENABLE_MARXIST_PRESET === 'true'
}
