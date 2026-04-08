import type { WorldState, Role } from '../types'
import { ZONE_LABELS } from '../types'
import { openSpotlight, close as closeSpotlight } from './spotlight'
import type { AIConfig } from '../types'
import { t } from '../i18n'

// ── Town layout ─────────────────────────────────────────────────────────────
// Three horizontal bands that read like a real settlement from above:
//
//   Top  : farmland (wide) + academy hill on the prestigious east
//   Core : west village → civic town square → market quarter → garrison
//   South: southern pastures + artisan row + east settlement
//
// Farms are deliberately large (they're open land); civic zones are smaller
// but centrally placed.  Adjacency in constitution.ts matches this geography.

interface ZoneInfo {
  seed: [number, number]
  darkColor: string
  lightColor: string
  label: string
}

const ZONE_LAYOUT: Record<string, ZoneInfo> = {
  north_farm:        { seed: [0.30, 0.16], darkColor: '#143a21', lightColor: '#b8f2cb', label: ZONE_LABELS['north_farm'] },
  scholar_quarter:   { seed: [0.76, 0.16], darkColor: '#1b2b60', lightColor: '#c6d5ff', label: ZONE_LABELS['scholar_quarter'] },
  residential_west:  { seed: [0.12, 0.44], darkColor: '#42256b', lightColor: '#dcc7ff', label: ZONE_LABELS['residential_west'] },
  plaza:             { seed: [0.36, 0.43], darkColor: '#23523f', lightColor: '#bdeedd', label: ZONE_LABELS['plaza'] },
  market_square:     { seed: [0.62, 0.43], darkColor: '#7a4f13', lightColor: '#ffe0b0', label: ZONE_LABELS['market_square'] },
  guard_post:        { seed: [0.88, 0.42], darkColor: '#6a1f2f', lightColor: '#ffc2cf', label: ZONE_LABELS['guard_post'] },
  south_farm:        { seed: [0.18, 0.78], darkColor: '#2a5f2f', lightColor: '#c8f0b8', label: ZONE_LABELS['south_farm'] },
  workshop_district: { seed: [0.50, 0.78], darkColor: '#5f3721', lightColor: '#f5ccb2', label: ZONE_LABELS['workshop_district'] },
  residential_east:  { seed: [0.82, 0.78], darkColor: '#2f3f8f', lightColor: '#cdd4ff', label: ZONE_LABELS['residential_east'] },
}

// ── Island geometry ─────────────────────────────────────────────────────────
// Control points define the rough shape; procedural fractal noise along the
// coastline and zone borders creates natural, jagged outlines like a real map.

const ISLAND_OUTLINE: [number, number][] = [
  [0.44, 0.015], [0.56, 0.012], [0.68, 0.022],
  [0.80, 0.055], [0.88, 0.105], [0.935, 0.185], [0.96, 0.28],
  [0.975, 0.38], [0.982, 0.48], [0.975, 0.58],
  [0.96, 0.68], [0.925, 0.77], [0.855, 0.85], [0.765, 0.91],
  [0.65, 0.96], [0.52, 0.985], [0.40, 0.97],
  [0.28, 0.93], [0.18, 0.87], [0.10, 0.78],
  [0.05, 0.67], [0.025, 0.55], [0.02, 0.43],
  [0.03, 0.32], [0.06, 0.22], [0.12, 0.135],
  [0.20, 0.07], [0.32, 0.03],
]

// ── Deterministic noise for natural borders ─────────────────────────────────

function _hash(n: number, seed: number): number {
  const x = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453
  return x - Math.floor(x)
}

function _smoothNoise(x: number, seed: number): number {
  const i = Math.floor(x)
  const f = x - i
  const u = f * f * (3 - 2 * f)
  return _hash(i, seed) + (_hash(i + 1, seed) - _hash(i, seed)) * u
}

function _fbm(x: number, seed: number): number {
  return _smoothNoise(x, seed) * 0.50
       + _smoothNoise(x * 2.3, seed + 50) * 0.30
       + _smoothNoise(x * 5.7, seed + 100) * 0.20
}

// ── Island path (jagged coastline) ──────────────────────────────────────────

let _islandPath: Path2D | null = null
let _islandW = 0
let _islandH = 0

function getIslandPath(W: number, H: number): Path2D {
  if (_islandPath && _islandW === W && _islandH === H) return _islandPath
  _islandW = W
  _islandH = H

  const raw = ISLAND_OUTLINE
  const n = raw.length
  const SUBS = 24

  const splinePts: [number, number][] = []
  for (let i = 0; i < n; i++) {
    const p0 = raw[(i - 1 + n) % n]
    const p1 = raw[i]
    const p2 = raw[(i + 1) % n]
    const p3 = raw[(i + 2) % n]
    for (let s = 0; s < SUBS; s++) {
      const t = s / SUBS
      const t2 = t * t, t3 = t2 * t
      splinePts.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ])
    }
  }

  const total = splinePts.length
  const path = new Path2D()
  for (let i = 0; i < total; i++) {
    const prev = splinePts[(i - 1 + total) % total]
    const next = splinePts[(i + 1) % total]
    const dx = next[0] - prev[0], dy = next[1] - prev[1]
    const len = Math.hypot(dx, dy) || 1
    const normX = -dy / len, normY = dx / len

    // Low-freq broad peninsulas/bays + mid-freq coves + high-freq jagged rocks
    const broad = (_fbm(i * 0.08, 42) - 0.5) * 2
    const mid   = (_fbm(i * 0.35, 71) - 0.5) * 2
    const fine  = (_smoothNoise(i * 1.4, 13) - 0.5) * 2
    const noiseVal = broad * 0.024 + mid * 0.014 + fine * 0.006
    const px = (splinePts[i][0] + normX * noiseVal) * W
    const py = (splinePts[i][1] + normY * noiseVal) * H

    if (i === 0) path.moveTo(px, py)
    else path.lineTo(px, py)
  }
  path.closePath()
  _islandPath = path
  return path
}

function isInsideIsland(nx: number, ny: number): boolean {
  const pts = ISLAND_OUTLINE
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0], yi = pts[i][1]
    const xj = pts[j][0], yj = pts[j][1]
    if ((yi > ny) !== (yj > ny) && nx < (xj - xi) * (ny - yi) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

// ── Voronoi zone polygons ───────────────────────────────────────────────────

type Pt = [number, number]

function _clipPolyByLine(poly: Pt[], lx: number, ly: number, nx: number, ny: number): Pt[] {
  const result: Pt[] = []
  const len = poly.length
  for (let i = 0; i < len; i++) {
    const curr = poly[i], next = poly[(i + 1) % len]
    const dc = (curr[0] - lx) * nx + (curr[1] - ly) * ny
    const dn = (next[0] - lx) * nx + (next[1] - ly) * ny
    if (dc <= 0) result.push(curr)
    if ((dc <= 0) !== (dn <= 0)) {
      const t = dc / (dc - dn)
      result.push([curr[0] + t * (next[0] - curr[0]), curr[1] + t * (next[1] - curr[1])])
    }
  }
  return result
}

function _voronoiCell(seedKey: string): Pt[] {
  const z = ZONE_LAYOUT[seedKey]
  const [sx, sy] = z.seed
  let poly: Pt[] = [[-0.3, -0.3], [1.3, -0.3], [1.3, 1.3], [-0.3, 1.3]]

  for (const [key, other] of Object.entries(ZONE_LAYOUT)) {
    if (key === seedKey) continue
    const [ox, oy] = other.seed
    const mx = (sx + ox) / 2, my = (sy + oy) / 2
    poly = _clipPolyByLine(poly, mx, my, ox - sx, oy - sy)
    if (poly.length < 3) return []
  }

  // Clip to island outline (CW in screen-coords: inside where cross >= 0)
  const coast = ISLAND_OUTLINE
  for (let i = 0; i < coast.length && poly.length >= 3; i++) {
    const a = coast[i], b = coast[(i + 1) % coast.length]
    const ex = b[0] - a[0], ey = b[1] - a[1]
    poly = _clipPolyByLine(poly, a[0], a[1], ey, -ex)
  }
  return poly
}

function _nearestZone(x: number, y: number): string {
  let best = '', bestD = Infinity
  for (const [key, z] of Object.entries(ZONE_LAYOUT)) {
    const dx = x - z.seed[0], dy = y - z.seed[1]
    const d = dx * dx + dy * dy
    if (d < bestD) { bestD = d; best = key }
  }
  return best
}

// Cached zone polygons (normalized coords) and Path2Ds (pixel coords)
let _zoneCells: Record<string, Pt[]> = {}
let _zonePaths: Record<string, Path2D> = {}
let _zoneBorderPaths: Path2D | null = null
let _zpW = 0, _zpH = 0

function _ensureZoneCells() {
  if (Object.keys(_zoneCells).length > 0) return
  for (const key of Object.keys(ZONE_LAYOUT)) _zoneCells[key] = _voronoiCell(key)
}

function _buildZonePolys(W: number, H: number) {
  if (_zpW === W && _zpH === H && Object.keys(_zonePaths).length > 0) return
  _zpW = W; _zpH = H
  _zoneCells = {}; _zonePaths = {}

  const zoneKeys = Object.keys(ZONE_LAYOUT)
  for (const key of zoneKeys) {
    const cell = _voronoiCell(key)
    _zoneCells[key] = cell
    if (cell.length < 3) continue
    const p = new Path2D()
    p.moveTo(cell[0][0] * W, cell[0][1] * H)
    for (let i = 1; i < cell.length; i++) p.lineTo(cell[i][0] * W, cell[i][1] * H)
    p.closePath()
    _zonePaths[key] = p
  }

  // Build noisy internal border paths (edges shared between two zone cells)
  const borderPath = new Path2D()
  const drawnEdges = new Set<string>()
  for (const key of zoneKeys) {
    const cell = _zoneCells[key]
    if (!cell || cell.length < 3) continue
    for (let i = 0; i < cell.length; i++) {
      const a = cell[i], b = cell[(i + 1) % cell.length]
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2
      if (!isInsideIsland(mx, my)) continue
      const nearA = _nearestZone(a[0], a[1])
      const nearB = _nearestZone(b[0], b[1])
      const nearM = _nearestZone(mx, my)
      // Skip edges that lie on the island coastline
      if (nearA === nearB && nearB === nearM && nearM === key) continue
      const edgeId = [a[0].toFixed(4), a[1].toFixed(4), b[0].toFixed(4), b[1].toFixed(4)].sort().join(',')
      if (drawnEdges.has(edgeId)) continue
      drawnEdges.add(edgeId)
      _addNoisyEdge(borderPath, a, b, W, H)
    }
  }
  _zoneBorderPaths = borderPath
}

function _addNoisyEdge(path: Path2D, a: Pt, b: Pt, W: number, H: number) {
  const segs = 28
  const dx = b[0] - a[0], dy = b[1] - a[1]
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len, ny = dx / len
  const seed = Math.abs(a[0] * 7919 + a[1] * 104729 + b[0] * 4507 + b[1] * 7727) % 1000
  for (let s = 0; s <= segs; s++) {
    const t = s / segs
    const broad = (_fbm(t * 3, seed) - 0.5) * 2
    const mid   = (_smoothNoise(t * 10, seed + 50) - 0.5) * 2
    const fine  = (_smoothNoise(t * 28, seed + 120) - 0.5) * 2
    const amp = len * 0.18
    const noise = broad * amp * 0.50 + mid * amp * 0.30 + fine * amp * 0.20
    const px = (a[0] + dx * t + nx * noise) * W
    const py = (a[1] + dy * t + ny * noise) * H
    if (s === 0) path.moveTo(px, py)
    else path.lineTo(px, py)
  }
}

// ── Home zone: where NPCs rest (residential areas) ─────────────────────────
// During resting, NPCs visually move to residential zones, populating them.

const WORK_TO_HOME: Record<string, string> = {
  north_farm:        'residential_west',
  south_farm:        'residential_west',
  workshop_district: 'residential_east',
  market_square:     'residential_east',
  scholar_quarter:   'residential_east',
  plaza:             'residential_west',
  guard_post:        'guard_post',
  residential_west:  'residential_west',
  residential_east:  'residential_east',
}

function getVisualZone(workZone: string, action: string): string {
  return action === 'resting' ? (WORK_TO_HOME[workZone] ?? workZone) : workZone
}

// ── Role colors ────────────────────────────────────────────────────────────

const ROLE_COLORS_DARK: Record<Role, string> = {
  farmer:    '#5de2b7',
  craftsman: '#4ea9ff',
  merchant:  '#ffbe52',
  scholar:   '#b39bff',
  guard:     '#ff6f7a',
  leader:    '#f5fbff',
  child:     '#d8dde6',
}

const ROLE_COLORS_LIGHT: Record<Role, string> = {
  farmer:    '#0f8f63',
  craftsman: '#1e63d8',
  merchant:  '#b16a00',
  scholar:   '#6645d4',
  guard:     '#c5364c',
  leader:    '#243043',
  child:     '#6d7788',
}

function roleColor(role: Role, light: boolean): string {
  return light ? ROLE_COLORS_LIGHT[role] : ROLE_COLORS_DARK[role]
}

// ── Map state ──────────────────────────────────────────────────────────────

let canvas: HTMLCanvasElement | null = null
let ctx: CanvasRenderingContext2D | null = null
let getWorld: (() => WorldState | null) | null = null
let getConfig: (() => AIConfig | null) | null = null
let animFrame: number | null = null
let hoveredNPCId: number | null = null
let frameCount = 0
let _mapPaused = false
/** When sim is paused, skip most frames unless user moved mouse / resized / tab visible again. */
let _needsMapRedraw = true
let _visibilityListenerAttached = false

// ── Selection state ───────────────────────────────────────────────────────────
let selectedNPCId: number | null = null
function isLightTheme(): boolean { return document.body.dataset.theme === 'light' }

export function setMapPaused(value: boolean) {
  _mapPaused = value
  if (!value) _needsMapRedraw = true
}

// ── NPC visual state (separate from sim data) ──────────────────────────────

interface CommuteState {
  sx: number; sy: number
  ex: number; ey: number
  t: number; duration: number
  destZone: string
}

interface NPCVisual {
  x: number
  y: number
  tx: number
  ty: number
  moveIn: number
  renderZone: string
  commute: CommuteState | null
}

// ── Family cluster info for attraction ─────────────────────────────────────

interface FamilyCluster {
  cx: number   // centroid x of visible family members
  cy: number   // centroid y of visible family members
  count: number
}

const npcVisuals = new Map<number, NPCVisual>()

function getOrInitVisual(npc: { id: number; x: number; y: number; zone: string; action_state: string }): NPCVisual {
  if (!npcVisuals.has(npc.id)) {
    const renderZone = getVisualZone(npc.zone, npc.action_state)
    const pos = randomPosInZone(renderZone)
    npcVisuals.set(npc.id, { x: pos.x, y: pos.y, tx: pos.x, ty: pos.y, moveIn: Math.random() * 120 | 0, renderZone, commute: null })
  }
  return npcVisuals.get(npc.id)!
}

function randomPosInZone(zone: string): { x: number; y: number } {
  const z = ZONE_LAYOUT[zone]
  if (!z) return { x: 0.5, y: 0.5 }

  _ensureZoneCells()
  const cell = _zoneCells[zone]
  if (cell && cell.length >= 3) {
    let minX = 1, maxX = 0, minY = 1, maxY = 0
    for (const [px, py] of cell) {
      if (px < minX) minX = px; if (px > maxX) maxX = px
      if (py < minY) minY = py; if (py > maxY) maxY = py
    }
    const pad = 0.02
    minX += pad; maxX -= pad; minY += pad; maxY -= pad
    for (let attempt = 0; attempt < 40; attempt++) {
      const x = minX + Math.random() * (maxX - minX)
      const y = minY + Math.random() * (maxY - minY)
      if (isInsideIsland(x, y) && _nearestZone(x, y) === zone) return { x, y }
    }
  }

  // Fallback: expanding radius from seed
  const [sx, sy] = z.seed
  for (let attempt = 0; attempt < 20; attempt++) {
    const r = 0.08 + attempt * 0.012
    const x = sx + (Math.random() - 0.5) * r * 2
    const y = sy + (Math.random() - 0.5) * r * 2
    if (isInsideIsland(x, y) && _nearestZone(x, y) === zone) return { x, y }
  }
  return { x: sx, y: sy }
}

const ACTION_SPEED: Record<string, number> = {
  working:    0.0006,  // calmer than before
  resting:    0.0002,  // very slow
  socializing:0.0010,
  organizing: 0.0014,
  fleeing:    0.003,
  confront:   0.002,
  complying:  0.0005,
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

function commuteDuration(npcId: number, _fromZ: string, _toZ: string): number {
  return 55 + (npcId % 37) * 2 + 35 + (npcId % 23)
}

function stepVisual(v: NPCVisual, action: string, workZone: string, family: FamilyCluster | null, npcId: number) {
  if (_mapPaused) return

  const targetZone = getVisualZone(workZone, action)

  // Smooth commute: lerp between zones instead of snapping
  if (v.commute) {
    if (v.commute.destZone !== targetZone) {
      const p = randomPosInZone(targetZone)
      v.commute = { sx: v.x, sy: v.y, ex: p.x, ey: p.y, t: 0, duration: commuteDuration(npcId, v.renderZone, targetZone), destZone: targetZone }
    }
    v.commute.t++
    const u = easeInOutCubic(Math.min(1, v.commute.t / v.commute.duration))
    v.x = v.commute.sx + (v.commute.ex - v.commute.sx) * u
    v.y = v.commute.sy + (v.commute.ey - v.commute.sy) * u
    if (v.commute.t >= v.commute.duration) {
      v.renderZone = v.commute.destZone
      v.commute = null
      v.moveIn = 0
      const settle = randomPosInZone(v.renderZone)
      v.tx = settle.x; v.ty = settle.y
    }
    return
  }

  if (targetZone !== v.renderZone) {
    const p = randomPosInZone(targetZone)
    v.commute = { sx: v.x, sy: v.y, ex: p.x, ey: p.y, t: 0, duration: commuteDuration(npcId, v.renderZone, targetZone), destZone: targetZone }
    return
  }

  v.moveIn--
  if (v.moveIn <= 0) {
    let t = randomPosInZone(v.renderZone)

    // Family attraction: blend target toward family cluster centroid.
    // Resting/socializing NPCs cluster tightly with family; working NPCs drift more freely.
    if (family && family.count > 0) {
      const weight = action === 'resting'     ? 0.65
                   : action === 'socializing' ? 0.40
                   : 0.15
      t.x = t.x * (1 - weight) + family.cx * weight
      t.y = t.y * (1 - weight) + family.cy * weight
      // Clamp: if family pull moved us out of our zone, snap back toward seed
      if (_nearestZone(t.x, t.y) !== v.renderZone || !isInsideIsland(t.x, t.y)) {
        const z = ZONE_LAYOUT[v.renderZone]
        if (z) { t.x = t.x * 0.5 + z.seed[0] * 0.5; t.y = t.y * 0.5 + z.seed[1] * 0.5 }
      }
    }

    v.tx = t.x
    v.ty = t.y
    // Longer intervals = calmer, less chaotic movement
    const freqMap: Record<string, number> = {
      resting: 360, working: 130, socializing: 55,
      organizing: 70, fleeing: 22, confront: 32, complying: 150,
    }
    v.moveIn = (freqMap[action] ?? 130) + (Math.random() * 40 | 0)
  }
  const speed = ACTION_SPEED[action] ?? 0.001
  v.x += (v.tx - v.x) * speed * 60
  v.y += (v.ty - v.y) * speed * 60
}

// ── Init ───────────────────────────────────────────────────────────────────

export function initMap(
  canvasEl: HTMLCanvasElement,
  worldGetter: () => WorldState | null,
  configGetter: () => AIConfig | null,
) {
  canvas  = canvasEl
  ctx     = canvasEl.getContext('2d')
  getWorld  = worldGetter
  getConfig = configGetter

  resizeCanvas()
  window.addEventListener('resize', resizeCanvas)

  canvas.addEventListener('mousemove', onMouseMove)
  canvas.addEventListener('click',     onClick)
  canvas.addEventListener('mouseleave', () => { hoveredNPCId = null })
  window.addEventListener('keydown', onKeyDown)

  if (animFrame !== null) cancelAnimationFrame(animFrame)

  if (!_visibilityListenerAttached) {
    _visibilityListenerAttached = true
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') _needsMapRedraw = true
    })
  }

  _needsMapRedraw = true
  drawLoop()
}

function resizeCanvas() {
  if (!canvas) return
  const container = canvas.parentElement
  if (!container) return
  canvas.width  = container.clientWidth
  canvas.height = container.clientHeight
  _islandPath = null
  _zpW = 0; _zpH = 0
  _needsMapRedraw = true
}

// ── Drawing constants ────────────────────────────────────────────────────────
// Max pixel distance to draw direct-tie lines (strong_ties are geographic, so kept short)
const DIRECT_TIE_MAX_DRAW_PX = 120
// Max pixel distance to draw info-tie lines (info_ties can span across zones)
const INFO_TIE_MAX_DRAW_PX = 280
// Info-tie alpha: base + pulse amplitude (creates a gentle breathing effect)
const INFO_TIE_BASE_ALPHA = 0.12
const INFO_TIE_PULSE_ALPHA = 0.10

// Cap weather particles so canvas stays cheap at high intensity / large viewports
const MAX_RAIN_DROPS = 220
const MAX_SNOW_FLAKES = 160
const MAX_SMOKE_PLUMES = 28

// When paused, redraw ~5fps unless _needsMapRedraw (hover, resize, visibility)
const PAUSED_FRAME_SKIP = 12

// ── Draw loop ──────────────────────────────────────────────────────────────

function drawLoop() {
  frameCount++

  if (document.visibilityState === 'hidden') {
    animFrame = requestAnimationFrame(drawLoop)
    return
  }

  if (_mapPaused && !_needsMapRedraw && frameCount % PAUSED_FRAME_SKIP !== 0) {
    animFrame = requestAnimationFrame(drawLoop)
    return
  }
  _needsMapRedraw = false

  draw()
  animFrame = requestAnimationFrame(drawLoop)
}

function draw() {
  if (!ctx || !canvas) return
  const W = canvas.width
  const H = canvas.height

  ctx.clearRect(0, 0, W, H)

  const world = getWorld?.()
  if (!world) {
    drawOcean(W, H)
    drawPlaceholder(W, H)
    return
  }

  drawZones(world, W, H)
  drawNPCs(world, W, H)
  drawAtmosphere(world, W, H)
  drawLegend(W, H)
}

function drawAtmosphere(world: WorldState, W: number, H: number) {
  if (!ctx) return
  const hour = world.tick % 24
  const dayLight = computeDaylight(hour)

  // Night/day tint overlay for immediate visual recognition.
  if (dayLight < 0.98) {
    ctx.save()
    const darkness = (1 - dayLight)
    ctx.fillStyle = isLightTheme()
      ? `rgba(210,220,235,${0.10 + darkness * 0.12})`
      : `rgba(5,10,24,${0.18 + darkness * 0.42})`
    ctx.fillRect(0, 0, W, H)
    ctx.restore()
  }

  const weather = computeWeather(world)
  if (weather.rain > 0) drawRain(W, H, weather.rain)
  if (weather.snow > 0) drawSnow(W, H, weather.snow)
  if (weather.dryFog > 0) drawDryFog(W, H, weather.dryFog)
  if (weather.smoke > 0) drawSmoke(W, H, weather.smoke)

  drawTimeBadge(hour, dayLight, W)
}

function computeDaylight(hour: number): number {
  // Dawn 5-8, day 8-17, dusk 17-20, night otherwise.
  if (hour >= 8 && hour < 17) return 1
  if (hour >= 5 && hour < 8) return 0.4 + ((hour - 5) / 3) * 0.6
  if (hour >= 17 && hour < 20) return 1 - ((hour - 17) / 3) * 0.6
  return 0.4
}

function computeWeather(world: WorldState): { rain: number; snow: number; dryFog: number; smoke: number } {
  let rain = 0
  let snow = 0
  let dryFog = 0
  let smoke = 0
  for (const ev of world.active_events) {
    const k = Math.max(0.15, Math.min(1, ev.intensity))
    if (ev.type === 'storm' || ev.type === 'flood' || ev.type === 'tsunami') rain = Math.max(rain, k)
    if (ev.type === 'harsh_winter') snow = Math.max(snow, k)
    if (ev.type === 'drought') dryFog = Math.max(dryFog, k)
    if (ev.type === 'wildfire' || ev.type === 'nuclear_explosion' || ev.type === 'bombing' || ev.type === 'volcanic_eruption' || ev.type === 'meteor_strike') smoke = Math.max(smoke, k)
  }
  return { rain, snow, dryFog, smoke }
}

function drawRain(W: number, H: number, intensity: number) {
  if (!ctx) return
  const drops = Math.min(MAX_RAIN_DROPS, Math.floor(120 + intensity * 260))
  ctx.save()
  ctx.strokeStyle = `rgba(130,180,255,${0.12 + intensity * 0.2})`
  ctx.lineWidth = 1
  for (let i = 0; i < drops; i++) {
    const x = ((i * 47 + frameCount * (10 + intensity * 14)) % (W + 40)) - 20
    const y = ((i * 73 + frameCount * (28 + intensity * 24)) % (H + 60)) - 30
    const len = 5 + intensity * 7
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x - 2, y + len)
    ctx.stroke()
  }
  ctx.restore()
}

function drawSnow(W: number, H: number, intensity: number) {
  if (!ctx) return
  const flakes = Math.min(MAX_SNOW_FLAKES, Math.floor(70 + intensity * 150))
  ctx.save()
  ctx.fillStyle = `rgba(240,245,255,${0.2 + intensity * 0.3})`
  for (let i = 0; i < flakes; i++) {
    const x = ((i * 59 + frameCount * (4 + intensity * 5)) % (W + 30)) - 15
    const y = ((i * 89 + frameCount * (9 + intensity * 8)) % (H + 40)) - 20
    const r = 0.8 + ((i % 3) * 0.45)
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function drawDryFog(W: number, H: number, intensity: number) {
  if (!ctx) return
  ctx.save()
  const grd = ctx.createLinearGradient(0, 0, W, H)
  grd.addColorStop(0, `rgba(210,185,120,${0.05 + intensity * 0.08})`)
  grd.addColorStop(1, `rgba(170,145,90,${0.08 + intensity * 0.1})`)
  ctx.fillStyle = grd
  ctx.fillRect(0, 0, W, H)
  ctx.restore()
}

function drawSmoke(W: number, H: number, intensity: number) {
  if (!ctx) return
  const plumes = Math.min(MAX_SMOKE_PLUMES, Math.floor(10 + intensity * 20))
  ctx.save()
  ctx.fillStyle = `rgba(80,80,85,${0.05 + intensity * 0.08})`
  for (let i = 0; i < plumes; i++) {
    const x = (i * 137 + frameCount * 0.8) % (W + 120) - 60
    const y = (i * 83 + frameCount * 0.35) % (H + 80) - 40
    const w = 80 + (i % 5) * 24
    const h = 26 + (i % 4) * 11
    ctx.beginPath()
    ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function drawTimeBadge(hour: number, dayLight: number, W: number) {
  if (!ctx) return
  const night = dayLight < 0.65
  const label = `${night ? '🌙' : '☀️'} ${String(hour).padStart(2, '0')}:00`
  const textW = ctx.measureText(label).width
  const x = W - textW - 18
  const y = 24
  ctx.save()
  if (isLightTheme()) ctx.fillStyle = night ? 'rgba(215,225,240,0.8)' : 'rgba(255,245,215,0.85)'
  else ctx.fillStyle = night ? 'rgba(10,14,30,0.75)' : 'rgba(35,28,10,0.55)'
  ctx.fillRect(x - 6, y - 12, textW + 12, 18)
  if (isLightTheme()) ctx.fillStyle = night ? 'rgba(55,75,115,0.95)' : 'rgba(120,90,20,0.95)'
  else ctx.fillStyle = night ? 'rgba(180,200,255,0.95)' : 'rgba(255,220,150,0.95)'
  ctx.font = '600 10px system-ui'
  ctx.fillText(label, x, y)
  ctx.restore()
}

function drawPlaceholder(W: number, H: number) {
  if (!ctx) return
  ctx.fillStyle = isLightTheme() ? 'rgba(255,255,255,0.65)' : 'rgba(160,200,255,0.35)'
  ctx.font = '13px system-ui'
  ctx.textAlign = 'center'
  ctx.fillText('Initializing...', W / 2, H / 2)
  ctx.textAlign = 'left'
}

function lightenHex(hex: string, mul: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgb(${Math.min(255, Math.round(r * mul))},${Math.min(255, Math.round(g * mul))},${Math.min(255, Math.round(b * mul))})`
}

function drawOcean(W: number, H: number) {
  if (!ctx) return
  const light = isLightTheme()
  const grd = ctx.createRadialGradient(
    W * 0.48, H * 0.45, Math.min(W, H) * 0.15,
    W * 0.50, H * 0.50, Math.max(W, H) * 0.75,
  )
  if (light) {
    grd.addColorStop(0, '#a8cce8')
    grd.addColorStop(0.6, '#7fb8da')
    grd.addColorStop(1, '#5a9ec5')
  } else {
    grd.addColorStop(0, '#0c1e38')
    grd.addColorStop(0.6, '#081628')
    grd.addColorStop(1, '#04101e')
  }
  ctx.fillStyle = grd
  ctx.fillRect(0, 0, W, H)

  const waveAlpha = light ? 0.07 : 0.05
  ctx.save()
  ctx.strokeStyle = light
    ? `rgba(255,255,255,${waveAlpha})`
    : `rgba(60,100,160,${waveAlpha})`
  ctx.lineWidth = 0.8
  for (let i = 0; i < 14; i++) {
    const baseY = (i / 14) * H * 1.2 - H * 0.1
    const phase = frameCount * 0.35 + i * 43
    ctx.beginPath()
    for (let x = -10; x <= W + 10; x += 8) {
      const y = baseY + Math.sin((x + phase) * 0.013) * 5 + Math.sin((x * 0.7 + phase * 0.6) * 0.019) * 3.5
      if (x <= 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
  ctx.restore()
}

// ── Event zone tint colors ─────────────────────────────────────────────────

type EventZoneTint = [number, number, number]  // [r, g, b]

const EVENT_ZONE_TINTS: Partial<Record<string, EventZoneTint>> = {
  earthquake:        [210, 110,  20],
  epidemic:          [180,  25,  25],
  wildfire:          [220,  70,   0],
  flood:             [ 30,  80, 200],
  tsunami:           [ 30,  80, 200],
  drought:           [190, 150,  20],
  harsh_winter:      [130, 165, 225],
  storm:             [ 50,  80, 170],
  nuclear_explosion: [ 80, 210,  40],
  bombing:           [ 90,  80,  80],
  volcanic_eruption: [200,  55,   0],
  meteor_strike:     [120,  50, 200],
  external_threat:   [160,  30,  30],
  blockade:          [130,  60,  20],
}

function drawZones(world: WorldState, W: number, H: number) {
  if (!ctx) return
  const light = isLightTheme()
  const coastPath = getIslandPath(W, H)
  _buildZonePolys(W, H)

  drawOcean(W, H)

  // Beach / sand ring
  ctx.save()
  ctx.strokeStyle = light ? 'rgba(218,198,148,0.55)' : 'rgba(90,75,40,0.35)'
  ctx.lineWidth = 7
  ctx.stroke(coastPath)
  ctx.restore()

  // Island base fill (visible as thin border between zones)
  ctx.fillStyle = light ? '#c8b888' : '#161208'
  ctx.fill(coastPath)

  // Zone polygon fills
  ctx.save()
  ctx.clip(coastPath)
  for (const [key, zone] of Object.entries(ZONE_LAYOUT)) {
    const cellPath = _zonePaths[key]
    if (!cellPath) continue
    const [sx, sy] = zone.seed
    const baseColor = light ? zone.lightColor : zone.darkColor
    const grd = ctx.createRadialGradient(
      sx * W, sy * H, 0,
      sx * W, sy * H, Math.max(W, H) * 0.35,
    )
    grd.addColorStop(0, lightenHex(baseColor, light ? 1.25 : 1.15))
    grd.addColorStop(0.6, baseColor)
    grd.addColorStop(1, lightenHex(baseColor, light ? 0.88 : 0.82))
    ctx.fillStyle = grd
    ctx.fill(cellPath)
  }

  // ── Event zone tinting overlay ────────────────────────────────────────────
  // Affected zones get a pulsing colored overlay based on the event type.
  // The overlay fades as the event progresses (fresher events = more visible).
  for (const ev of world.active_events) {
    const tint = EVENT_ZONE_TINTS[ev.type]
    if (!tint) continue
    const progress = ev.elapsed_ticks / ev.duration_ticks
    const pulse = 0.5 + 0.5 * Math.sin(frameCount * 0.05)
    const baseAlpha = (0.18 + pulse * 0.10) * (1 - progress * 0.5) * ev.intensity
    const [r, g, b] = tint
    for (const zone of ev.zones) {
      const cellPath = _zonePaths[zone]
      if (!cellPath) continue
      ctx.fillStyle = `rgba(${r},${g},${b},${baseAlpha.toFixed(3)})`
      ctx.fill(cellPath)
    }
  }

  // Noisy zone borders
  if (_zoneBorderPaths) {
    ctx.strokeStyle = light ? 'rgba(0,0,0,0.14)' : 'rgba(255,255,255,0.08)'
    ctx.lineWidth = 1.4
    ctx.stroke(_zoneBorderPaths)
    ctx.strokeStyle = light ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.03)'
    ctx.lineWidth = 3
    ctx.stroke(_zoneBorderPaths)
  }
  ctx.restore()

  // Coastline — two-pass stroke for depth
  ctx.save()
  ctx.strokeStyle = light ? 'rgba(80,65,35,0.55)' : 'rgba(50,40,18,0.60)'
  ctx.lineWidth = 3
  ctx.stroke(coastPath)
  ctx.strokeStyle = light ? 'rgba(255,245,210,0.18)' : 'rgba(255,255,200,0.05)'
  ctx.lineWidth = 1.2
  ctx.stroke(coastPath)
  ctx.restore()

  // Zone labels (at seed positions)
  ctx.font = light ? '700 11px system-ui' : '600 10px system-ui'
  ctx.textAlign = 'center'
  for (const [, zone] of Object.entries(ZONE_LAYOUT)) {
    const cx = zone.seed[0] * W
    const cy = zone.seed[1] * H - 4
    if (light) {
      ctx.fillStyle = 'rgba(255,255,255,0.92)'
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]] as const) {
        ctx.fillText(zone.label, cx + ox, cy + oy)
      }
      ctx.fillStyle = 'rgba(18, 24, 32, 0.92)'
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.4)'
      ctx.fillText(zone.label, cx + 1, cy + 1)
      ctx.fillStyle = 'rgba(255,255,255,0.45)'
    }
    ctx.fillText(zone.label, cx, cy)
  }
  ctx.textAlign = 'left'
}

// ── Selected NPC relationship overlay ─────────────────────────────────────────
// Drawn BEFORE NPC dots so lines appear underneath dots.
// The selection glow ring is drawn AFTER the dots inside drawNPCs.

function drawSelectedNPCTies(
  world: WorldState,
  posMap: Map<number, { px: number; py: number }>,
) {
  if (!ctx || selectedNPCId === null) return
  const npc = world.npcs.find(n => n.id === selectedNPCId)
  if (!npc || !npc.lifecycle.is_alive) {
    selectedNPCId = null
    closeSpotlight()
    return
  }

  const pos = posMap.get(npc.id)
  if (!pos) return
  const { px, py } = pos
  const pulse = 0.5 + 0.5 * Math.sin(frameCount * 0.07)

  // ── Weak-tie indicators: soft ring around each weak-tie NPC (no lines) ───
  if (npc.weak_ties?.length) {
    for (const tid of npc.weak_ties) {
      const bNpc = world.npcs[tid]
      if (!bNpc?.lifecycle.is_alive) continue
      const bPos = posMap.get(tid)
      if (!bPos) continue
      ctx.beginPath()
      ctx.arc(bPos.px, bPos.py, 5.5, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(180,180,230,0.25)'
      ctx.lineWidth = 1.0
      ctx.stroke()
    }
  }

  // ── Info ties: dashed blue lines ─────────────────────────────────────────
  if (npc.info_ties?.length) {
    ctx.setLineDash([4, 6])
    for (const tid of npc.info_ties) {
      const bNpc = world.npcs[tid]
      if (!bNpc?.lifecycle.is_alive) continue
      const bPos = posMap.get(tid)
      if (!bPos) continue
      ctx.beginPath()
      ctx.moveTo(px, py)
      ctx.lineTo(bPos.px, bPos.py)
      ctx.strokeStyle = `rgba(80,160,255,${0.38 + pulse * 0.22})`
      ctx.lineWidth = 0.8
      ctx.stroke()
    }
    ctx.setLineDash([])
  }

  // ── Strong ties: solid warm lines + ring on each tie partner ─────────────
  for (const tid of npc.strong_ties) {
    const bNpc = world.npcs[tid]
    if (!bNpc?.lifecycle.is_alive) continue
    const bPos = posMap.get(tid)
    if (!bPos) continue
    ctx.beginPath()
    ctx.moveTo(px, py)
    ctx.lineTo(bPos.px, bPos.py)
    ctx.strokeStyle = `rgba(255,165,50,${0.60 + pulse * 0.28})`
    ctx.lineWidth = 1.4
    ctx.stroke()
    // Ring on tie partner
    ctx.beginPath()
    ctx.arc(bPos.px, bPos.py, 5.5, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(255,165,50,${0.50 + pulse * 0.20})`
    ctx.lineWidth = 1.2
    ctx.stroke()
  }
}

function drawNPCs(world: WorldState, W: number, H: number) {
  if (!ctx) return
  const light = isLightTheme()

  // ── Build family clusters ──────────────────────────────────────────────
  // For each NPC, compute the centroid of family members (spouse + children)
  // that are currently rendered in the same zone. Used to attract NPCs toward
  // their family when picking new movement targets.
  const familyClusters = new Map<number, FamilyCluster>()

  for (const npc of world.npcs) {
    if (!npc.lifecycle.is_alive) continue

    const familyIds: number[] = []
    if (npc.lifecycle.spouse_id !== null) familyIds.push(npc.lifecycle.spouse_id)
    for (const cid of npc.lifecycle.children_ids) familyIds.push(cid)
    if (familyIds.length === 0) continue

    // My expected render zone this frame
    const myRenderZone = npcVisuals.get(npc.id)?.renderZone
      ?? getVisualZone(npc.zone, npc.action_state)

    const samezone: { x: number; y: number }[] = []
    for (const fid of familyIds) {
      if (fid < 0 || fid >= world.npcs.length) continue
      const fNpc = world.npcs[fid]
      if (!fNpc?.lifecycle.is_alive) continue
      const fVis = npcVisuals.get(fid)
      if (!fVis) continue
      if (fVis.renderZone === myRenderZone) {
        samezone.push({ x: fVis.x, y: fVis.y })
      }
    }

    if (samezone.length > 0) {
      familyClusters.set(npc.id, {
        cx: samezone.reduce((s, p) => s + p.x, 0) / samezone.length,
        cy: samezone.reduce((s, p) => s + p.y, 0) / samezone.length,
        count: samezone.length,
      })
    }
  }

  // ── Step visuals and build position lookup ─────────────────────────────
  const posMap = new Map<number, { px: number; py: number }>()

  for (const npc of world.npcs) {
    if (!npc.lifecycle.is_alive) continue
    if (!ZONE_LAYOUT[npc.zone]) continue

    const v = getOrInitVisual(npc)
    stepVisual(v, npc.action_state, npc.zone, familyClusters.get(npc.id) ?? null, npc.id)

    const px = v.x * W
    const py = v.y * H
    posMap.set(npc.id, { px, py })
  }

  // ── Build related-NPC set for selection mode ──────────────────────────────
  const relatedIds = new Set<number>()
  if (selectedNPCId !== null) {
    const sel = world.npcs.find(n => n.id === selectedNPCId)
    if (sel) {
      relatedIds.add(sel.id)
      for (const id of sel.strong_ties) relatedIds.add(id)
      for (const id of sel.info_ties)   relatedIds.add(id)
      for (const id of sel.weak_ties)   relatedIds.add(id)
    }
  }
  const hasSelection = relatedIds.size > 0

  // ── Family bond lines (spouse pairs in same render zone) ─────────────────
  const drawnFamilyPairs = new Set<string>()
  for (const npc of world.npcs) {
    if (!npc.lifecycle.is_alive) continue
    if (npc.lifecycle.spouse_id === null) continue
    const sid = npc.lifecycle.spouse_id
    if (sid < 0 || sid >= world.npcs.length) continue
    const pairKey = npc.id < sid ? `${npc.id}-${sid}` : `${sid}-${npc.id}`
    if (drawnFamilyPairs.has(pairKey)) continue
    drawnFamilyPairs.add(pairKey)

    const spouse = world.npcs[sid]
    if (!spouse?.lifecycle.is_alive) continue

    const aPos = posMap.get(npc.id)
    const bPos = posMap.get(sid)
    if (!aPos || !bPos) continue

    // In selection mode: only draw bonds that involve the selected NPC or its connections
    if (hasSelection && !relatedIds.has(npc.id) && !relatedIds.has(sid)) continue

    const aVis = npcVisuals.get(npc.id)
    const bVis = npcVisuals.get(sid)
    if (!aVis || !bVis || aVis.renderZone !== bVis.renderZone) continue

    const dist = Math.hypot(aPos.px - bPos.px, aPos.py - bPos.py)
    if (dist > 90) continue  // only draw when close together

    const bothResting = npc.action_state === 'resting' && spouse.action_state === 'resting'
    const alpha = bothResting ? 0.35 : 0.12
    ctx.beginPath()
    ctx.moveTo(aPos.px, aPos.py)
    ctx.lineTo(bPos.px, bPos.py)
    ctx.strokeStyle = `rgba(255,200,120,${alpha})`  // warm golden family bond
    ctx.lineWidth = 0.8
    ctx.globalAlpha = 1
    ctx.stroke()
  }

  // ── Social relationship lines ──────────────────────────────────────────
  // Skipped in selection mode — drawSelectedNPCTies handles the selected NPC's ties.
  const drawnPairs = new Set<string>()
  const drawnInfoPairs = new Set<string>()
  const pulse = 0.5 + 0.5 * Math.sin(frameCount * 0.05)  // 0–1 pulsing

  if (!hasSelection) for (const npc of world.npcs) {
    if (!npc.lifecycle.is_alive) continue
    const aPos = posMap.get(npc.id)
    if (!aPos) continue

    // Draw information-network ties (info_ties) as blue/cyan dashed lines
    // Visible when NPCs are actively sharing information (socializing or organizing)
    const isActiveInfo = npc.action_state === 'socializing' || npc.action_state === 'organizing'
    if (isActiveInfo && npc.info_ties) {
      for (const tid of npc.info_ties) {
        const pairKey = npc.id < tid ? `${npc.id}-${tid}` : `${tid}-${npc.id}`
        if (drawnInfoPairs.has(pairKey)) continue
        drawnInfoPairs.add(pairKey)

        const bNpc = world.npcs[tid]
        if (!bNpc?.lifecycle.is_alive) continue
        const bPos = posMap.get(bNpc.id)
        if (!bPos) continue

        // Info ties can span across zones — use a longer draw distance than direct ties
        const dist = Math.hypot(aPos.px - bPos.px, aPos.py - bPos.py)
        if (dist > INFO_TIE_MAX_DRAW_PX) continue

        const bIsActive = bNpc.action_state === 'socializing' || bNpc.action_state === 'organizing'
        if (!bIsActive) continue

        const infoAlpha = INFO_TIE_BASE_ALPHA + pulse * INFO_TIE_PULSE_ALPHA
        ctx.beginPath()
        ctx.moveTo(aPos.px, aPos.py)
        ctx.lineTo(bPos.px, bPos.py)
        ctx.strokeStyle = `rgba(80,160,255,${infoAlpha})`  // blue — information network
        ctx.lineWidth = 0.6
        ctx.setLineDash([3, 5])  // dashed to distinguish from direct ties
        ctx.globalAlpha = 1
        ctx.stroke()
        ctx.setLineDash([])  // reset dash
        ctx.globalAlpha = 1
      }
    }

    // Draw direct strong-tie lines (face-to-face connections)
    for (const tid of npc.strong_ties) {
      const pairKey = npc.id < tid ? `${npc.id}-${tid}` : `${tid}-${npc.id}`
      if (drawnPairs.has(pairKey)) continue
      drawnPairs.add(pairKey)

      const bNpc = world.npcs[tid]
      if (!bNpc?.lifecycle.is_alive) continue
      const bPos = posMap.get(bNpc.id)
      if (!bPos) continue

      // Canvas-space distance
      const dist = Math.hypot(aPos.px - bPos.px, aPos.py - bPos.py)
      if (dist > DIRECT_TIE_MAX_DRAW_PX) continue  // direct ties are geographic — draw only nearby

      const isSocializing = npc.action_state === 'socializing' || bNpc.action_state === 'socializing'
      const isOrganizing  = npc.action_state === 'organizing'  || bNpc.action_state === 'organizing'
      const isFleeing     = npc.action_state === 'fleeing'

      let lineColor: string

      if (isOrganizing) {
        lineColor = `rgba(239,159,39,${0.3 + pulse * 0.3})`  // amber — mobilising
      } else if (isSocializing) {
        lineColor = `rgba(93,202,165,${0.25 + pulse * 0.2})`  // teal — socialising
      } else if (isFleeing) {
        lineColor = `rgba(226,75,75,0.15)`  // red dim — panic network
      } else {
        lineColor = `rgba(255,255,255,0.05)`  // near-invisible working ties
      }

      ctx.beginPath()
      ctx.moveTo(aPos.px, aPos.py)
      ctx.lineTo(bPos.px, bPos.py)
      ctx.strokeStyle = lineColor
      ctx.lineWidth = isSocializing || isOrganizing ? 1 : 0.5
      ctx.globalAlpha = 1
      ctx.stroke()
      ctx.globalAlpha = 1
    }
  } // end if (!hasSelection)

  // ── Selected NPC relationship overlay (over normal ties, under dots) ────
  drawSelectedNPCTies(world, posMap)

  // ── NPC dots ────────────────────────────────────────────────────────────
  for (const npc of world.npcs) {
    if (!npc.lifecycle.is_alive) continue
    const pos = posMap.get(npc.id)
    if (!pos) continue
    const { px, py } = pos

    // In selection mode: dim unrelated NPCs to near-invisible
    const isRelated = !hasSelection || relatedIds.has(npc.id)
    ctx.globalAlpha = isRelated ? 1 : 0.06

    const color = roleColor(npc.role, light)
    const isHovered = npc.id === hoveredNPCId
    // Children are rendered as smaller dots to distinguish them from adults
    const isChild = npc.role === 'child'
    const baseRadius = isChild ? 1.5 : 2.5
    const radius = isHovered ? 5 : baseRadius

    // Sick ring — pulsing sickly green
    if (npc.sick) {
      const sickPulse = 0.5 + 0.5 * Math.sin(frameCount * 0.11 + npc.id * 0.61)
      ctx.beginPath()
      ctx.arc(px, py, radius + 3.5, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(140,210,60,${0.35 + sickPulse * 0.30})`
      ctx.lineWidth = 1.2
      ctx.stroke()
    }

    // On-strike ring — amber, outer
    if (npc.on_strike) {
      const strikePulse = 0.5 + 0.5 * Math.sin(frameCount * 0.055 + npc.id * 0.4)
      ctx.beginPath()
      ctx.arc(px, py, radius + 5, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(239,159,39,${0.40 + strikePulse * 0.25})`
      ctx.lineWidth = 1.4
      ctx.stroke()
    }

    // Stress ring
    if (npc.stress > 60) {
      ctx.beginPath()
      ctx.arc(px, py, radius + 2.5, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(226,75,75,${(npc.stress - 60) / 40 * 0.6})`
      ctx.lineWidth = 1.5
      ctx.stroke()
    }

    ctx.beginPath()
    ctx.arc(px, py, radius + 1.1, 0, Math.PI * 2)
    ctx.fillStyle = light ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.45)'
    ctx.fill()

    ctx.beginPath()
    ctx.arc(px, py, radius, 0, Math.PI * 2)
    ctx.fillStyle = isHovered ? (light ? '#111' : '#fff') : color
    ctx.fill()

    // Selection glow ring — drawn on top of the dot
    if (npc.id === selectedNPCId) {
      const selPulse = 0.5 + 0.5 * Math.sin(frameCount * 0.07)
      // Outer pulsing ring
      ctx.beginPath()
      ctx.arc(px, py, radius + 3.5 + selPulse * 2.5, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(255,220,60,${0.55 + selPulse * 0.30})`
      ctx.lineWidth = 1.8
      ctx.stroke()
      // Inner crisp ring
      ctx.beginPath()
      ctx.arc(px, py, radius + 2.5, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(255,255,255,0.90)'
      ctx.lineWidth = 1.0
      ctx.stroke()
    }

    // Name label on hover
    if (isHovered) {
      const label = `${npc.name} (${npc.role})`
      const textW = ctx.measureText(label).width
      const bx = Math.min(px - textW / 2 - 4, W - textW - 12)
      const by = py - 22

      ctx.fillStyle = 'rgba(0,0,0,0.85)'
      ctx.fillRect(bx, by, textW + 8, 16)
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 10px system-ui'
      ctx.textAlign = 'left'
      ctx.fillText(label, bx + 4, by + 11)
    }
  }

  ctx.globalAlpha = 1  // restore after dot loop

  // Update hovered NPC canvas position for interaction
  _posMapCache = posMap
}

function drawLegend(W: number, H: number) {
  if (!ctx) return
  const light = isLightTheme()
  const roles: Role[] = ['farmer', 'craftsman', 'merchant', 'scholar', 'guard', 'leader', 'child']

  const margin = 12
  const pad = 10
  const gap = 5
  const lineW = 22
  const bgR = 6
  const titleH = 11
  const netRowH = 13
  const hintH = 11
  const rolesTitleH = 10
  const roleRowH = 20
  ctx.textAlign = 'left'

  const heading = String(t('map.legend.heading'))
  const netRows: { dash: boolean; color: string; label: string }[] = [
    { dash: true, color: 'rgba(80,160,255,0.85)', label: String(t('map.legend.info')) },
    { dash: false, color: 'rgba(93,202,165,0.78)', label: String(t('map.legend.strong')) },
    { dash: false, color: 'rgba(255,200,120,0.88)', label: String(t('map.legend.family')) },
  ]
  const spotlightHint = String(t('map.legend.spotlight'))
  const rolesTitle = String(t('map.legend.roles_title'))

  ctx.font = '600 9px system-ui'
  let blockW = pad * 2 + ctx.measureText(heading).width

  ctx.font = '8px system-ui'
  for (const r of netRows) {
    const w = pad * 2 + lineW + 6 + ctx.measureText(r.label).width
    blockW = Math.max(blockW, w)
  }
  blockW = Math.max(blockW, pad * 2 + ctx.measureText(spotlightHint).width)
  blockW = Math.max(blockW, pad * 2 + ctx.measureText(rolesTitle).width)

  let rolesRowW = 0
  ctx.font = '8px system-ui'
  for (const role of roles) {
    const label = role.charAt(0).toUpperCase() + role.slice(1)
    rolesRowW += ctx.measureText(label).width + 20
  }
  blockW = Math.ceil(Math.max(blockW, rolesRowW + pad * 2))

  const blockH =
    pad +
    titleH +
    gap +
    netRows.length * (netRowH + gap) -
    gap +
    gap +
    hintH +
    gap +
    rolesTitleH +
    gap +
    roleRowH +
    pad

  const blockRight = W - margin
  const blockLeft = blockRight - blockW
  const blockBottom = H - margin
  const blockTop = blockBottom - blockH

  ctx.fillStyle = light ? 'rgba(255,255,255,0.78)' : 'rgba(0,0,0,0.58)'
  ctx.beginPath()
  ctx.moveTo(blockLeft + bgR, blockTop)
  ctx.arcTo(blockRight, blockTop, blockRight, blockBottom, bgR)
  ctx.arcTo(blockRight, blockBottom, blockLeft, blockBottom, bgR)
  ctx.arcTo(blockLeft, blockBottom, blockLeft, blockTop, bgR)
  ctx.arcTo(blockLeft, blockTop, blockRight, blockTop, bgR)
  ctx.fill()

  const textColor = light ? 'rgba(0,0,0,0.72)' : 'rgba(255,255,255,0.58)'
  let y = blockTop + pad

  ctx.fillStyle = textColor
  ctx.font = '600 9px system-ui'
  ctx.fillText(heading, blockLeft + pad, y + 9)
  y += titleH + gap

  ctx.font = '8px system-ui'
  for (const r of netRows) {
    const midY = y + Math.floor(netRowH / 2)
    ctx.beginPath()
    ctx.moveTo(blockLeft + pad, midY)
    ctx.lineTo(blockLeft + pad + lineW, midY)
    ctx.lineWidth = 1
    if (r.dash) {
      ctx.setLineDash([3, 4])
      ctx.strokeStyle = r.color
      ctx.stroke()
      ctx.setLineDash([])
    } else {
      ctx.strokeStyle = r.color
      ctx.stroke()
    }
    ctx.fillStyle = textColor
    ctx.fillText(r.label, blockLeft + pad + lineW + 6, midY + 3)
    y += netRowH + gap
  }

  ctx.fillStyle = light ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.42)'
  ctx.fillText(spotlightHint, blockLeft + pad, y + 8)
  y += hintH + gap

  ctx.fillStyle = textColor
  ctx.fillText(rolesTitle, blockLeft + pad, y + 8)
  y += rolesTitleH + gap

  let x = blockLeft + pad
  const roleBaseline = y + 10
  for (const role of roles) {
    ctx.beginPath()
    ctx.arc(x + 4, roleBaseline - 4, 4, 0, Math.PI * 2)
    ctx.fillStyle = roleColor(role, light)
    ctx.fill()

    ctx.fillStyle = textColor
    const label = role.charAt(0).toUpperCase() + role.slice(1)
    ctx.fillText(label, x + 11, roleBaseline)
    x += ctx.measureText(label).width + 20
  }
}

// ── Interaction ────────────────────────────────────────────────────────────

let _posMapCache = new Map<number, { px: number; py: number }>()

function getNPCAtPosition(world: WorldState, mx: number, my: number): number | null {
  let closest: number | null = null
  let closestDist = 12 // px hit-radius

  for (const npc of world.npcs) {
    if (!npc.lifecycle.is_alive) continue
    const pos = _posMapCache.get(npc.id)
    if (!pos) continue
    const d = Math.hypot(pos.px - mx, pos.py - my)
    if (d < closestDist) {
      closestDist = d
      closest = npc.id
    }
  }
  return closest
}

function onMouseMove(e: MouseEvent) {
  if (!canvas) return
  const world = getWorld?.()
  if (!world) return

  const rect = canvas.getBoundingClientRect()
  const mx = e.clientX - rect.left
  const my = e.clientY - rect.top

  const nextHover = getNPCAtPosition(world, mx, my)
  if (nextHover !== hoveredNPCId) {
    hoveredNPCId = nextHover
    _needsMapRedraw = true
  }
  canvas.style.cursor = hoveredNPCId !== null ? 'pointer' : 'default'
}

function onClick(e: MouseEvent) {
  if (!canvas) return
  const world  = getWorld?.()
  const config = getConfig?.()
  if (!world) return

  const rect = canvas.getBoundingClientRect()
  const mx = e.clientX - rect.left
  const my = e.clientY - rect.top

  const npcId = getNPCAtPosition(world, mx, my)
  if (npcId !== null) {
    const npc = world.npcs.find(n => n.id === npcId)
    if (npc) {
      selectedNPCId = npcId
      _needsMapRedraw = true
      openSpotlight(npc, world, config ?? null)
    }
  } else {
    selectedNPCId = null
    _needsMapRedraw = true
    closeSpotlight()
  }
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape' && selectedNPCId !== null) {
    selectedNPCId = null
    _needsMapRedraw = true
    closeSpotlight()
  }
}
