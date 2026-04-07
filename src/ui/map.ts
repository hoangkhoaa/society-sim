import type { WorldState, Role } from '../types'
import { ZONE_LABELS } from '../types'
import { openSpotlight } from './spotlight'
import type { AIConfig } from '../types'

// ── Town layout ─────────────────────────────────────────────────────────────
// Three horizontal bands that read like a real settlement from above:
//
//   Top  : farmland (wide) + academy hill on the prestigious east
//   Core : west village → civic town square → market quarter → garrison
//   South: southern pastures + artisan row + east settlement
//
// Farms are deliberately large (they're open land); civic zones are smaller
// but centrally placed.  Adjacency in constitution.ts matches this geography.

interface ZoneRect { x: number; y: number; w: number; h: number; color: string; label: string }

const ZONE_LAYOUT: Record<string, ZoneRect> = {
  // Row 0  (y 0→0.30): northern outskirts
  north_farm:        { x: 0.00, y: 0.00, w: 0.62, h: 0.30, color: '#0f2a0a', label: ZONE_LABELS['north_farm'] },
  scholar_quarter:   { x: 0.62, y: 0.00, w: 0.38, h: 0.30, color: '#0d1433', label: ZONE_LABELS['scholar_quarter'] },

  // Row 1  (y 0.30→0.60): city core
  residential_west:  { x: 0.00, y: 0.30, w: 0.22, h: 0.30, color: '#17143a', label: ZONE_LABELS['residential_west'] },
  plaza:             { x: 0.22, y: 0.30, w: 0.28, h: 0.30, color: '#1d2b1a', label: ZONE_LABELS['plaza'] },
  market_square:     { x: 0.50, y: 0.30, w: 0.26, h: 0.30, color: '#2e2008', label: ZONE_LABELS['market_square'] },
  guard_post:        { x: 0.76, y: 0.30, w: 0.24, h: 0.30, color: '#2a0e10', label: ZONE_LABELS['guard_post'] },

  // Row 2  (y 0.60→1.00): southern outskirts
  south_farm:        { x: 0.00, y: 0.60, w: 0.34, h: 0.40, color: '#122e0b', label: ZONE_LABELS['south_farm'] },
  workshop_district: { x: 0.34, y: 0.60, w: 0.33, h: 0.40, color: '#2a1808', label: ZONE_LABELS['workshop_district'] },
  residential_east:  { x: 0.67, y: 0.60, w: 0.33, h: 0.40, color: '#151240', label: ZONE_LABELS['residential_east'] },
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

const ROLE_COLORS: Record<Role, string> = {
  farmer:    '#5dcaa5',
  craftsman: '#378add',
  merchant:  '#ef9f27',
  scholar:   '#7f77dd',
  guard:     '#e24b4b',
  leader:    '#ffffff',
  child:     '#aaaaaa',   // light grey — children are smaller dots
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
function isLightTheme(): boolean { return document.body.dataset.theme === 'light' }

export function setMapPaused(value: boolean) { _mapPaused = value }

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
    const z = ZONE_LAYOUT[renderZone]
    if (!z) return { x: npc.x, y: npc.y, tx: npc.x, ty: npc.y, moveIn: 0, renderZone, commute: null }
    const cx = z.x + npc.x * z.w
    const cy = z.y + npc.y * z.h
    npcVisuals.set(npc.id, { x: cx, y: cy, tx: cx, ty: cy, moveIn: Math.random() * 120 | 0, renderZone, commute: null })
  }
  return npcVisuals.get(npc.id)!
}

function randomPosInZone(zone: string): { x: number; y: number } {
  const z = ZONE_LAYOUT[zone]
  if (!z) return { x: 0.5, y: 0.5 }
  const margin = 0.025
  return {
    x: z.x + margin + Math.random() * (z.w - margin * 2),
    y: z.y + margin + Math.random() * (z.h - margin * 2),
  }
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
      // Clamp to stay inside zone bounds
      const z = ZONE_LAYOUT[v.renderZone]
      if (z) {
        const m = 0.015
        t.x = Math.max(z.x + m, Math.min(z.x + z.w - m, t.x))
        t.y = Math.max(z.y + m, Math.min(z.y + z.h - m, t.y))
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

  if (animFrame !== null) cancelAnimationFrame(animFrame)
  drawLoop()
}

function resizeCanvas() {
  if (!canvas) return
  const container = canvas.parentElement
  if (!container) return
  canvas.width  = container.clientWidth
  canvas.height = container.clientHeight
}

// ── Drawing constants ────────────────────────────────────────────────────────
// Max pixel distance to draw direct-tie lines (strong_ties are geographic, so kept short)
const DIRECT_TIE_MAX_DRAW_PX = 120
// Max pixel distance to draw info-tie lines (info_ties can span across zones)
const INFO_TIE_MAX_DRAW_PX = 280
// Info-tie alpha: base + pulse amplitude (creates a gentle breathing effect)
const INFO_TIE_BASE_ALPHA = 0.12
const INFO_TIE_PULSE_ALPHA = 0.10

// ── Draw loop ──────────────────────────────────────────────────────────────

function drawLoop() {
  frameCount++
  draw()
  animFrame = requestAnimationFrame(drawLoop)
}

function draw() {
  if (!ctx || !canvas) return
  const W = canvas.width
  const H = canvas.height

  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = isLightTheme() ? '#eef3f8' : '#111'
  ctx.fillRect(0, 0, W, H)

  const world = getWorld?.()
  if (!world) {
    drawPlaceholder(W, H)
    return
  }

  drawZones(W, H)
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
  return 0.35
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
    if (ev.type === 'wildfire') smoke = Math.max(smoke, k)
  }
  return { rain, snow, dryFog, smoke }
}

function drawRain(W: number, H: number, intensity: number) {
  if (!ctx) return
  const drops = Math.floor(120 + intensity * 260)
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
  const flakes = Math.floor(70 + intensity * 150)
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
  const plumes = Math.floor(10 + intensity * 20)
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
  ctx.fillStyle = isLightTheme() ? '#4a5568' : '#222'
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

function drawZones(W: number, H: number) {
  if (!ctx) return
  const gutter = Math.max(2, Math.min(W, H) * 0.008)
  const cornerR = Math.min(14, Math.min(W, H) * 0.016)
  const c = ctx as CanvasRenderingContext2D & { roundRect?(x: number, y: number, w: number, h: number, r: number): void }

  for (const [, zone] of Object.entries(ZONE_LAYOUT)) {
    const px = zone.x * W + gutter
    const py = zone.y * H + gutter
    const pw = zone.w * W - 2 * gutter
    const ph = zone.h * H - 2 * gutter
    if (pw < 8 || ph < 8) continue

    const grd = ctx.createLinearGradient(px, py, px, py + ph)
    grd.addColorStop(0, lightenHex(zone.color, 1.25))
    grd.addColorStop(0.55, zone.color)
    grd.addColorStop(1, lightenHex(zone.color, 0.85))

    ctx.fillStyle = grd
    ctx.beginPath()
    if (typeof c.roundRect === 'function') c.roundRect(px, py, pw, ph, cornerR)
    else ctx.rect(px, py, pw, ph)
    ctx.fill()

    ctx.beginPath()
    if (typeof c.roundRect === 'function') c.roundRect(px, py, pw, ph, cornerR)
    else ctx.rect(px, py, pw, ph)
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'
    ctx.lineWidth = 1.2
    ctx.stroke()

    ctx.fillStyle = 'rgba(255,255,255,0.42)'
    ctx.font = '600 10px system-ui'
    ctx.textAlign = 'center'
    ctx.fillText(zone.label, px + pw / 2, py + 14)
    ctx.textAlign = 'left'
  }
}

function drawNPCs(world: WorldState, W: number, H: number) {
  if (!ctx) return

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
  // Draw strong-tie lines for direct connections and info-tie lines for information network
  const drawnPairs = new Set<string>()
  const drawnInfoPairs = new Set<string>()
  const pulse = 0.5 + 0.5 * Math.sin(frameCount * 0.05)  // 0–1 pulsing

  for (const npc of world.npcs) {
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
  }

  // ── NPC dots ────────────────────────────────────────────────────────────
  for (const npc of world.npcs) {
    if (!npc.lifecycle.is_alive) continue
    const pos = posMap.get(npc.id)
    if (!pos) continue
    const { px, py } = pos

    const color = ROLE_COLORS[npc.role]
    const isHovered = npc.id === hoveredNPCId
    // Children are rendered as smaller dots to distinguish them from adults
    const isChild = npc.role === 'child'
    const baseRadius = isChild ? 1.5 : 2.5
    const radius = isHovered ? 5 : baseRadius

    // Stress ring
    if (npc.stress > 60) {
      ctx.beginPath()
      ctx.arc(px, py, radius + 2.5, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(226,75,75,${(npc.stress - 60) / 40 * 0.6})`
      ctx.lineWidth = 1.5
      ctx.stroke()
    }

    ctx.beginPath()
    ctx.arc(px, py, radius, 0, Math.PI * 2)
    ctx.fillStyle = isHovered ? '#fff' : color
    ctx.fill()

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

  // Update hovered NPC canvas position for interaction
  _posMapCache = posMap
}

function drawLegend(W: number, H: number) {
  if (!ctx) return
  const roles: Role[] = ['farmer', 'craftsman', 'merchant', 'scholar', 'guard', 'leader', 'child']

  ctx.font = '9px system-ui'
  ctx.textAlign = 'left'

  // Draw legend at bottom-right to avoid overlapping the demographics panel (bottom-left)
  // First measure total width
  let totalW = 0
  for (const role of roles) {
    const label = role.charAt(0).toUpperCase() + role.slice(1)
    totalW += ctx.measureText(label).width + 22
  }
  const startX = W - totalW - 8
  let x = startX
  const y = H - 8

  for (const role of roles) {
    ctx.beginPath()
    ctx.arc(x + 4, y - 4, 4, 0, Math.PI * 2)
    ctx.fillStyle = ROLE_COLORS[role]
    ctx.fill()

    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    const label = role.charAt(0).toUpperCase() + role.slice(1)
    ctx.fillText(label, x + 11, y)
    x += ctx.measureText(label).width + 22
  }

  // Info network line legend
  const infoLegendY = H - 22
  ctx.setLineDash([3, 4])
  ctx.beginPath()
  ctx.moveTo(W - 100, infoLegendY)
  ctx.lineTo(W - 80, infoLegendY)
  ctx.strokeStyle = 'rgba(80,160,255,0.6)'
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle = 'rgba(255,255,255,0.4)'
  ctx.font = '8px system-ui'
  ctx.fillText('Info net', W - 77, infoLegendY + 3)
}

// ── Interaction ────────────────────────────────────────────────────────────

let _posMapCache = new Map<number, { px: number; py: number }>()

function getNPCAtPosition(world: WorldState, mx: number, my: number, _W: number, _H: number): number | null {
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

  hoveredNPCId = getNPCAtPosition(world, mx, my, canvas.width, canvas.height)
  canvas.style.cursor = hoveredNPCId !== null ? 'pointer' : 'default'
}

function onClick(e: MouseEvent) {
  if (!canvas) return
  const world  = getWorld?.()
  const config = getConfig?.()
  if (!world || !config) return

  const rect = canvas.getBoundingClientRect()
  const mx = e.clientX - rect.left
  const my = e.clientY - rect.top

  const npcId = getNPCAtPosition(world, mx, my, canvas.width, canvas.height)
  if (npcId !== null) {
    const npc = world.npcs[npcId]
    if (npc) openSpotlight(npc, world, config)
  }
}
