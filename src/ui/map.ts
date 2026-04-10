import type { WorldState, Role } from '../types'
import { openSpotlight, close as closeSpotlight } from './spotlight'
import type { AIConfig } from '../types'
import { t } from '../i18n'
import { ZONE_ADJACENCY } from '../sim/constitution'

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
}

const ZONE_LAYOUT: Record<string, ZoneInfo> = {
  north_farm:        { seed: [0.29,  0.165], darkColor: '#143a21', lightColor: '#b8f2cb' },
  scholar_quarter:   { seed: [0.80,  0.165], darkColor: '#1b2b60', lightColor: '#c6d5ff' },
  residential_west:  { seed: [0.125, 0.50],  darkColor: '#42256b', lightColor: '#dcc7ff' },
  plaza:             { seed: [0.39,  0.50],  darkColor: '#23523f', lightColor: '#bdeedd' },
  market_square:     { seed: [0.64,  0.50],  darkColor: '#7a4f13', lightColor: '#ffe0b0' },
  guard_post:        { seed: [0.885, 0.50], darkColor: '#6a1f2f', lightColor: '#ffc2cf' },
  south_farm:        { seed: [0.175, 0.835], darkColor: '#2a5f2f', lightColor: '#c8f0b8' },
  workshop_district: { seed: [0.51,  0.835], darkColor: '#5f3721', lightColor: '#f5ccb2' },
  residential_east:  { seed: [0.835, 0.835], darkColor: '#2f3f8f', lightColor: '#cdd4ff' },
}

// ── Fixed zone bounding rectangles ──────────────────────────────────────────
// City-map grid. All coords normalized 0–1. The gaps between rectangles ARE
// the roads — the background colour shows through as streets.
//
// Row 0  y 0.02–0.31  (top band)
// H1 rd  y 0.31–0.37  centre y=0.34
// Row 1  y 0.37–0.63  (middle band)
// H2 rd  y 0.63–0.69  centre y=0.66
// Row 2  y 0.69–0.98  (bottom band)

interface ZoneRect { x1: number; y1: number; x2: number; y2: number }

const ZONE_RECTS: Record<string, ZoneRect> = {
  north_farm:        { x1: 0.02, y1: 0.02, x2: 0.56, y2: 0.31 },
  scholar_quarter:   { x1: 0.62, y1: 0.02, x2: 0.98, y2: 0.31 },
  residential_west:  { x1: 0.02, y1: 0.37, x2: 0.23, y2: 0.63 },
  plaza:             { x1: 0.29, y1: 0.37, x2: 0.49, y2: 0.63 },
  market_square:     { x1: 0.55, y1: 0.37, x2: 0.73, y2: 0.63 },
  guard_post:        { x1: 0.79, y1: 0.37, x2: 0.98, y2: 0.63 },
  south_farm:        { x1: 0.02, y1: 0.69, x2: 0.33, y2: 0.98 },
  workshop_district: { x1: 0.39, y1: 0.69, x2: 0.63, y2: 0.98 },
  residential_east:  { x1: 0.69, y1: 0.69, x2: 0.98, y2: 0.98 },
}

// ── Road junction waypoints ─────────────────────────────────────────────────
// Key = alphabetically sorted zone pair joined with '|'.
// Values = normalized coords of intermediate points in the road network.
// NPCs travel: zone_centroid → waypoints → dest_centroid.

const ROAD_WAYPOINTS: Record<string, [number, number][]> = {
  'north_farm|residential_west':        [[0.26, 0.34]],
  'north_farm|plaza':                   [[0.39, 0.34]],
  'north_farm|scholar_quarter':         [[0.59, 0.165]],
  'guard_post|scholar_quarter':         [[0.885, 0.34]],
  'market_square|scholar_quarter':      [[0.64,  0.34]],
  'plaza|residential_west':             [[0.26, 0.50]],
  'residential_west|south_farm':        [[0.125, 0.66]],
  'market_square|plaza':                [[0.52, 0.50]],
  'plaza|south_farm':                   [[0.26, 0.66]],
  'plaza|workshop_district':            [[0.52, 0.66]],
  'guard_post|market_square':           [[0.76, 0.50]],
  'market_square|workshop_district':    [[0.66, 0.66]],
  'market_square|residential_east':     [[0.76, 0.66]],
  'guard_post|residential_east':        [[0.835, 0.66]],
  'south_farm|workshop_district':       [[0.36, 0.835]],
  'residential_east|workshop_district': [[0.66, 0.835]],
}

// ── Road topology for multi-hop routing ─────────────────────────────────────
// Vertical road segments: centre-x and the y-range they span.
const V_ROAD_SEGS: { x: number; yMin: number; yMax: number }[] = [
  { x: 0.59, yMin: 0,    yMax: 0.34 },   // V-top
  { x: 0.26, yMin: 0.34, yMax: 0.66 },   // V1
  { x: 0.52, yMin: 0.34, yMax: 0.66 },   // V2
  { x: 0.76, yMin: 0.34, yMax: 0.66 },   // V3
  { x: 0.36, yMin: 0.66, yMax: 1.00 },   // V4
  { x: 0.66, yMin: 0.66, yMax: 1.00 },   // V5
]
const H_ROAD_YS = [0.34, 0.66] as const   // H1, H2 centre-lines

const ROAD_EPS  = 0.04  // tolerance for "on this road?"
const POINT_EPS = 0.01  // tolerance for "same point?" (backtrack detection)

function nearHRoad(y: number): number | null {
  for (const hy of H_ROAD_YS) if (Math.abs(y - hy) < ROAD_EPS) return hy
  return null
}

function nearVRoad(x: number, y: number): number | null {
  for (const v of V_ROAD_SEGS) {
    if (Math.abs(x - v.x) < ROAD_EPS && y >= v.yMin - ROAD_EPS && y <= v.yMax + ROAD_EPS) return v.x
  }
  return null
}

/** Find the closest vertical road that spans between two horizontal roads. */
function bestVRoadBetweenH(x1: number, x2: number, h1: number, h2: number): number {
  const lo = Math.min(h1, h2), hi = Math.max(h1, h2)
  const candidates = V_ROAD_SEGS.filter(v => v.yMin <= lo + ROAD_EPS && v.yMax >= hi - ROAD_EPS)
  if (candidates.length === 0) return (x1 + x2) / 2         // fallback (should not happen)
  const mid = (x1 + x2) / 2
  candidates.sort((a, b) => Math.abs(a.x - mid) - Math.abs(b.x - mid))
  return candidates[0].x
}

/**
 * Insert intermediate road-grid junctions between consecutive waypoints so that
 * NPC commute paths follow drawn roads instead of cutting diagonally through zones.
 * Only processes the "road waypoint" portion of the path (not start/dest in zones).
 */
function insertRoadJunctions(roadPts: [number, number][]): [number, number][] {
  if (roadPts.length < 2) return roadPts
  const out: [number, number][] = [roadPts[0]]
  for (let i = 1; i < roadPts.length; i++) {
    const from = out[out.length - 1]
    const to   = roadPts[i]
    const dx   = Math.abs(from[0] - to[0])
    const dy   = Math.abs(from[1] - to[1])
    if (dx > ROAD_EPS && dy > ROAD_EPS) {
      // Points are on different roads — insert corner junction(s)
      const fH = nearHRoad(from[1])
      const fV = nearVRoad(from[0], from[1])
      const tH = nearHRoad(to[1])
      const tV = nearVRoad(to[0], to[1])

      if (fV !== null && tH !== null) {
        // vertical → horizontal: corner at (fV, tH)
        out.push([fV, tH])
      } else if (fH !== null && tV !== null) {
        // horizontal → vertical: corner at (tV, fH)
        out.push([tV, fH])
      } else if (fH !== null && tH !== null) {
        // both horizontal: route through the nearest connecting vertical road
        const vx = bestVRoadBetweenH(from[0], to[0], fH, tH)
        out.push([vx, fH])
        out.push([vx, tH])
      } else if (fV !== null && tV !== null) {
        // both vertical: route through the nearest horizontal road
        const midY = (from[1] + to[1]) / 2
        const hy = H_ROAD_YS.reduce((best, h) => Math.abs(h - midY) < Math.abs(best - midY) ? h : best, H_ROAD_YS[0] as number)
        out.push([fV, hy])
        out.push([tV, hy])
      } else {
        // fallback: L-shaped corner preferring horizontal-first
        out.push([to[0], from[1]])
      }
    }
    out.push(to)
  }
  return out
}

/** Remove U-turn backtracking where the path revisits the same road junction. */
function removeRoadBacktracking(pts: [number, number][]): [number, number][] {
  if (pts.length < 3) return pts
  const result: [number, number][] = []
  let i = 0
  while (i < pts.length) {
    result.push(pts[i])
    // If this point appears again later, skip the detour between
    let lastMatch = i
    for (let j = i + 1; j < pts.length; j++) {
      if (Math.abs(pts[i][0] - pts[j][0]) < POINT_EPS && Math.abs(pts[i][1] - pts[j][1]) < POINT_EPS) {
        lastMatch = j
      }
    }
    i = lastMatch + 1
  }
  return result
}

function getRoadWaypoints(fromZone: string, toZone: string): [number, number][] {
  const key = [fromZone, toZone].sort().join('|')
  return ROAD_WAYPOINTS[key] ?? []
}

/** BFS on ZONE_ADJACENCY graph — returns shortest zone-hop sequence [from, ..., to] */
function findZonePath(from: string, to: string): string[] {
  if (from === to) return [from]
  const visited = new Set<string>([from])
  const queue: string[][] = [[from]]
  while (queue.length > 0) {
    const path = queue.shift()!
    const cur = path[path.length - 1]
    for (const neighbor of (ZONE_ADJACENCY[cur] ?? [])) {
      if (neighbor === to) return [...path, neighbor]
      if (!visited.has(neighbor)) {
        visited.add(neighbor)
        queue.push([...path, neighbor])
      }
    }
  }
  return [from, to]  // fallback
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
let _mapSelectNpcListenerAttached = false
let _legendVisible = true

// ── Selection state ───────────────────────────────────────────────────────────
let selectedNPCId: number | null = null
function isLightTheme(): boolean { return document.body.dataset.theme === 'light' }

export function setMapPaused(value: boolean) {
  _mapPaused = value
  if (!value) _needsMapRedraw = true
}

export function setMapLegendVisible(value: boolean) {
  _legendVisible = value
  _needsMapRedraw = true
}

// ── Map shake / flash effect ───────────────────────────────────────────────

let _shakeEndTime  = 0
let _shakeIntensity = 0
let _flashOpacity  = 0   // 0–1 white flash overlay
let _flashDecay    = 0   // how fast flash fades per frame

export function triggerMapShake(durationMs: number, intensity: number, flashWhite = false) {
  _shakeEndTime   = performance.now() + durationMs
  _shakeIntensity = intensity
  if (flashWhite) {
    _flashOpacity = 1
    _flashDecay   = 0.018   // fades over ~55 frames ≈ ~0.9 s at 60fps
  }
  _needsMapRedraw = true
}

// ── NPC visual state (separate from sim data) ──────────────────────────────

interface CommuteState {
  /** Full path through road network: [start, ...road_junctions, dest] in normalized coords */
  waypoints: [number, number][]
  t: number
  duration: number
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
  const rect = ZONE_RECTS[zone]
  const z    = ZONE_LAYOUT[zone]
  if (!rect) return z ? { x: z.seed[0], y: z.seed[1] } : { x: 0.5, y: 0.5 }
  const pad = 0.025
  const x = rect.x1 + pad + Math.random() * Math.max(0, rect.x2 - rect.x1 - pad * 2)
  const y = rect.y1 + pad + Math.random() * Math.max(0, rect.y2 - rect.y1 - pad * 2)
  return { x, y }
}

const ACTION_SPEED: Record<string, number> = {
  working:    0.0006,
  resting:    0,       // sleeping: no movement at all
  family:     0.0004,  // at home: very gentle drift within the room
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

/** Build a commute path: current position → road junctions → random spot in destZone */
function buildCommutePath(
  sx: number, sy: number,
  fromZone: string, toZone: string,
): [number, number][] {
  const zonePath = findZonePath(fromZone, toZone)
  // Collect raw road waypoints from each hop
  const rawRoad: [number, number][] = []
  for (let i = 0; i < zonePath.length - 1; i++) {
    const junctions = getRoadWaypoints(zonePath[i], zonePath[i + 1])
    rawRoad.push(...junctions)
  }
  // Route road waypoints through the grid so NPC follows drawn roads
  const routed = rawRoad.length >= 2
    ? removeRoadBacktracking(insertRoadJunctions(rawRoad))
    : rawRoad
  const dest = randomPosInZone(toZone)
  return [[sx, sy], ...routed, [dest.x, dest.y]]
}

/** Advance a commute along its waypoint path using global ease. Returns true when done. */
function advanceCommute(v: NPCVisual): boolean {
  const c = v.commute!
  c.t++
  const raw      = Math.min(1, c.t / c.duration)
  const progress = easeInOutCubic(raw)          // smooth globally
  const pts      = c.waypoints
  const numSegs  = pts.length - 1
  if (numSegs > 0) {
    const sp     = progress * numSegs
    const seg    = Math.min(numSegs - 1, Math.floor(sp))
    const segT   = sp - seg                     // linear within segment
    const from   = pts[seg]
    const to     = pts[Math.min(numSegs, seg + 1)]
    v.x = from[0] + (to[0] - from[0]) * segT
    v.y = from[1] + (to[1] - from[1]) * segT
  }
  return c.t >= c.duration
}

function stepVisual(v: NPCVisual, action: string, workZone: string, family: FamilyCluster | null, npcId: number) {
  if (_mapPaused) return

  const targetZone = getVisualZone(workZone, action)

  // Sleeping NPCs commute home first, then freeze.
  if (action === 'resting') {
    if (v.commute) {
      if (advanceCommute(v)) {
        v.renderZone = v.commute.destZone
        v.commute = null
        v.moveIn = 9999
        const settle = randomPosInZone(v.renderZone)
        v.tx = settle.x; v.ty = settle.y
      }
    } else if (targetZone !== v.renderZone) {
      v.commute = {
        waypoints: buildCommutePath(v.x, v.y, v.renderZone, targetZone),
        t: 0,
        duration: commuteDuration(npcId, v.renderZone, targetZone),
        destZone: targetZone,
      }
    }
    return
  }

  // Active commute along road network
  if (v.commute) {
    if (v.commute.destZone !== targetZone) {
      // destination changed mid-commute — re-route from current position
      v.commute = {
        waypoints: buildCommutePath(v.x, v.y, v.renderZone, targetZone),
        t: 0,
        duration: commuteDuration(npcId, v.renderZone, targetZone),
        destZone: targetZone,
      }
    }
    if (advanceCommute(v)) {
      v.renderZone = v.commute.destZone
      v.commute = null
      v.moveIn = 0
      const settle = randomPosInZone(v.renderZone)
      v.tx = settle.x; v.ty = settle.y
    }
    return
  }

  if (targetZone !== v.renderZone) {
    v.commute = {
      waypoints: buildCommutePath(v.x, v.y, v.renderZone, targetZone),
      t: 0,
      duration: commuteDuration(npcId, v.renderZone, targetZone),
      destZone: targetZone,
    }
    return
  }

  v.moveIn--
  if (v.moveIn <= 0) {
    let t = randomPosInZone(v.renderZone)

    // Family attraction: blend target toward family cluster centroid.
    // Resting/socializing NPCs cluster tightly with family; working NPCs drift more freely.
    if (family && family.count > 0) {
      const weight = action === 'family'      ? 0.80   // at home: cluster tightly with household
                   : action === 'socializing' ? 0.40
                   : 0.15
      t.x = t.x * (1 - weight) + family.cx * weight
      t.y = t.y * (1 - weight) + family.cy * weight
      // Clamp: if family pull moved us out of our zone rect, snap back toward seed
      const r = ZONE_RECTS[v.renderZone]
      const outsideRect = r && (t.x < r.x1 || t.x > r.x2 || t.y < r.y1 || t.y > r.y2)
      if (outsideRect) {
        const z = ZONE_LAYOUT[v.renderZone]
        if (z) { t.x = t.x * 0.5 + z.seed[0] * 0.5; t.y = t.y * 0.5 + z.seed[1] * 0.5 }
      }
    }

    v.tx = t.x
    v.ty = t.y
    // Longer intervals = calmer, less chaotic movement
    const freqMap: Record<string, number> = {
      resting: 9999, working: 130, socializing: 55, family: 240,
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

  if (!_mapSelectNpcListenerAttached) {
    _mapSelectNpcListenerAttached = true
    document.addEventListener('map-select-npc', (ev: Event) => {
      const e = ev as CustomEvent<{ id: number }>
      const id = e.detail?.id
      if (typeof id === 'number' && Number.isFinite(id)) {
        selectedNPCId = id
        _needsMapRedraw = true
      }
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

  // ── Shake / flash effects ────────────────────────────────────────────────
  const now = performance.now()
  const shaking = now < _shakeEndTime
  let sx = 0, sy = 0
  if (shaking) {
    const t = (_shakeEndTime - now) / 1000   // remaining seconds
    const amp = _shakeIntensity * Math.min(1, t * 2)   // ease out
    sx = (Math.random() - 0.5) * amp * 2
    sy = (Math.random() - 0.5) * amp * 2
    _needsMapRedraw = true
  }

  if (sx !== 0 || sy !== 0) {
    ctx.save()
    ctx.translate(sx, sy)
  }

  const world = getWorld?.()
  if (!world) {
    drawCityBackground(W, H, isLightTheme())
    drawPlaceholder(W, H)
    if (sx !== 0 || sy !== 0) ctx.restore()
    return
  }

  drawZones(world, W, H)
  drawNPCs(world, W, H)
  drawAtmosphere(world, W, H)
  if (_legendVisible) drawLegend(W, H)

  if (sx !== 0 || sy !== 0) ctx.restore()

  // White flash overlay (fades after impact)
  if (_flashOpacity > 0) {
    ctx.fillStyle = `rgba(255,200,120,${_flashOpacity})`
    ctx.fillRect(0, 0, W, H)
    _flashOpacity = Math.max(0, _flashOpacity - _flashDecay)
    _needsMapRedraw = true
  }
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
  ctx.fillText(String(t('map.initializing')), W / 2, H / 2)
  ctx.textAlign = 'left'
}

function lightenHex(hex: string, mul: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgb(${Math.min(255, Math.round(r * mul))},${Math.min(255, Math.round(g * mul))},${Math.min(255, Math.round(b * mul))})`
}

// ── City map background (replaces ocean) ───────────────────────────────────
// The road network is the background. Zone rectangles are painted on top;
// the background colour shows through in the gaps = streets.

function drawCityBackground(W: number, H: number, light: boolean) {
  if (!ctx) return
  // Asphalt/pavement base colour
  ctx.fillStyle = light ? '#c9c4b9' : '#111418'
  ctx.fillRect(0, 0, W, H)
}

function drawRoadMarkings(W: number, H: number, light: boolean) {
  if (!ctx) return
  ctx.save()

  // ── Sidewalk kerb lines along every road edge ─────────────────────────────
  ctx.strokeStyle = light ? 'rgba(180,170,155,0.7)' : 'rgba(38,46,58,0.8)'
  ctx.lineWidth = 1
  const edges: [number, number, number, number][] = [
    // Horizontal road H1 (y 0.31–0.37) top & bottom kerbs
    [0, 0.31*H, W, 0.31*H], [0, 0.37*H, W, 0.37*H],
    // Horizontal road H2 (y 0.63–0.69)
    [0, 0.63*H, W, 0.63*H], [0, 0.69*H, W, 0.69*H],
    // Vertical road top row: x 0.56–0.62
    [0.56*W, 0, 0.56*W, 0.31*H], [0.62*W, 0, 0.62*W, 0.31*H],
    // Vertical roads row 1: V1(0.23–0.29) V2(0.49–0.55) V3(0.73–0.79)
    [0.23*W, 0.31*H, 0.23*W, 0.69*H], [0.29*W, 0.31*H, 0.29*W, 0.69*H],
    [0.49*W, 0.31*H, 0.49*W, 0.69*H], [0.55*W, 0.31*H, 0.55*W, 0.69*H],
    [0.73*W, 0.31*H, 0.73*W, 0.69*H], [0.79*W, 0.31*H, 0.79*W, 0.69*H],
    // Vertical roads row 2: V4(0.33–0.39) V5(0.63–0.69)
    [0.33*W, 0.63*H, 0.33*W, H], [0.39*W, 0.63*H, 0.39*W, H],
    [0.63*W, 0.63*H, 0.63*W, H], [0.69*W, 0.63*H, 0.69*W, H],
  ]
  for (const [x1, y1, x2, y2] of edges) {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
  }

  // ── Road centre-line dashes ───────────────────────────────────────────────
  ctx.setLineDash([8, 10])
  ctx.strokeStyle = light ? 'rgba(190,175,100,0.55)' : 'rgba(255,220,80,0.22)'
  ctx.lineWidth = 1.5
  const centres: [number, number, number, number][] = [
    [0, 0.34*H, W, 0.34*H],                      // H1 centre
    [0, 0.66*H, W, 0.66*H],                      // H2 centre
    [0.59*W, 0, 0.59*W, 0.31*H],                 // V top-row
    [0.26*W, 0.31*H, 0.26*W, 0.69*H],            // V1
    [0.52*W, 0.31*H, 0.52*W, 0.69*H],            // V2
    [0.76*W, 0.31*H, 0.76*W, 0.69*H],            // V3
    [0.36*W, 0.63*H, 0.36*W, H],                 // V4
    [0.66*W, 0.63*H, 0.66*W, H],                 // V5
  ]
  for (const [x1, y1, x2, y2] of centres) {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
  }
  ctx.setLineDash([])

  // ── Road junction dots ────────────────────────────────────────────────────
  ctx.fillStyle = light ? 'rgba(160,148,110,0.55)' : 'rgba(255,220,80,0.16)'
  const junctions: [number, number][] = [
    [0.26, 0.34], [0.52, 0.34], [0.59, 0.34], [0.76, 0.34],
    [0.26, 0.66], [0.36, 0.66], [0.52, 0.66], [0.66, 0.66],
    [0.76, 0.66], [0.835, 0.66],
  ]
  for (const [nx, ny] of junctions) {
    ctx.beginPath()
    ctx.arc(nx * W, ny * H, 3.5, 0, Math.PI * 2)
    ctx.fill()
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

// Zone icons displayed in the top-left of each district block
const ZONE_ICONS: Record<string, string> = {
  north_farm:        '🌾',
  south_farm:        '🌿',
  workshop_district: '⚒',
  market_square:     '⚖',
  scholar_quarter:   '📜',
  residential_west:  '🏠',
  residential_east:  '🏡',
  guard_post:        '⚔',
  plaza:             '🏛',
}

function drawZoneRect(
  zone: string, W: number, H: number, light: boolean,
  eventAlpha = 0, tint?: EventZoneTint,
) {
  if (!ctx) return
  const rect = ZONE_RECTS[zone]
  const info = ZONE_LAYOUT[zone]
  if (!rect || !info) return

  const x = rect.x1 * W, y = rect.y1 * H
  const w = (rect.x2 - rect.x1) * W
  const h = (rect.y2 - rect.y1) * H
  const r = 3   // corner radius px

  const baseColor = light ? info.lightColor : info.darkColor
  const grd = ctx.createLinearGradient(x, y, x + w, y + h)
  grd.addColorStop(0, lightenHex(baseColor, light ? 1.18 : 1.12))
  grd.addColorStop(1, lightenHex(baseColor, light ? 0.92 : 0.88))
  ctx.fillStyle = grd

  // Rounded rectangle
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
  ctx.fill()

  // Event tint overlay
  if (eventAlpha > 0 && tint) {
    ctx.fillStyle = `rgba(${tint[0]},${tint[1]},${tint[2]},${eventAlpha.toFixed(3)})`
    ctx.fill()
  }

  // Subtle border
  ctx.strokeStyle = light ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.08)'
  ctx.lineWidth = 1
  ctx.stroke()
}

function drawZones(world: WorldState, W: number, H: number) {
  if (!ctx) return
  const light = isLightTheme()

  // 1. City ground / road background
  drawCityBackground(W, H, light)

  // 2. Road markings (kerbs + centre dashes + junctions)
  drawRoadMarkings(W, H, light)

  // 3. Compute event tints per zone
  const zoneTintAlpha: Record<string, number> = {}
  const zoneTintColor: Record<string, EventZoneTint> = {}
  const pulse = 0.5 + 0.5 * Math.sin(frameCount * 0.05)
  for (const ev of world.active_events) {
    const tint = EVENT_ZONE_TINTS[ev.type]
    if (!tint) continue
    const progress  = ev.elapsed_ticks / ev.duration_ticks
    const baseAlpha = (0.22 + pulse * 0.12) * (1 - progress * 0.5) * ev.intensity
    for (const zone of ev.zones) {
      if ((zoneTintAlpha[zone] ?? 0) < baseAlpha) {
        zoneTintAlpha[zone] = baseAlpha
        zoneTintColor[zone] = tint
      }
    }
  }

  // 4. Zone blocks
  for (const zone of Object.keys(ZONE_RECTS)) {
    drawZoneRect(zone, W, H, light, zoneTintAlpha[zone] ?? 0, zoneTintColor[zone])
  }

  // 5. Zone labels + icons
  ctx.textAlign = 'center'
  for (const [key, info] of Object.entries(ZONE_LAYOUT)) {
    const rect = ZONE_RECTS[key]
    if (!rect) continue
    const cx  = info.seed[0] * W
    const cy  = info.seed[1] * H
    const zoneLabel = String(t(`zone.${key}`))

    // Icon (slightly above centroid)
    ctx.font = '14px system-ui'
    ctx.globalAlpha = 0.70
    ctx.fillText(ZONE_ICONS[key] ?? '', cx, cy - 8)
    ctx.globalAlpha = 1

    // Label
    ctx.font = light ? '700 10px system-ui' : '600 9px system-ui'
    if (light) {
      ctx.fillStyle = 'rgba(255,255,255,0.9)'
      for (const [ox, oy] of [[1,0],[-1,0],[0,1],[0,-1]] as const)
        ctx.fillText(zoneLabel, cx + ox, cy + 8 + oy)
      ctx.fillStyle = 'rgba(12,18,28,0.9)'
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.5)'
      ctx.fillText(zoneLabel, cx + 1, cy + 9)
      ctx.fillStyle = 'rgba(255,255,255,0.50)'
    }
    ctx.fillText(zoneLabel, cx, cy + 8)
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
      const label = `${npc.name} (${String(t(`role.${npc.role}`))})`
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
    const label = String(t(`role.${role}` as const))
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
    const label = String(t(`role.${role}` as const))
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
