import type { WorldState, Role } from '../types'
import { ZONE_LABELS } from '../types'
import { openSpotlight } from './spotlight'
import type { AIConfig } from '../types'

// ── Zone layout (normalized 0–1 grid, 3×3) ─────────────────────────────────

interface ZoneRect { x: number; y: number; w: number; h: number; color: string; label: string }

const ZONE_LAYOUT: Record<string, ZoneRect> = {
  north_farm:        { x: 0.00, y: 0.00, w: 0.33, h: 0.35, color: '#0d2408', label: ZONE_LABELS['north_farm'] },
  south_farm:        { x: 0.00, y: 0.35, w: 0.33, h: 0.30, color: '#102c0a', label: ZONE_LABELS['south_farm'] },
  residential_west:  { x: 0.00, y: 0.65, w: 0.33, h: 0.35, color: '#13102a', label: ZONE_LABELS['residential_west'] },
  workshop_district: { x: 0.33, y: 0.00, w: 0.34, h: 0.40, color: '#261608', label: ZONE_LABELS['workshop_district'] },
  plaza:             { x: 0.33, y: 0.40, w: 0.34, h: 0.25, color: '#1a2218', label: ZONE_LABELS['plaza'] },
  residential_east:  { x: 0.33, y: 0.65, w: 0.34, h: 0.35, color: '#12102a', label: ZONE_LABELS['residential_east'] },
  scholar_quarter:   { x: 0.67, y: 0.00, w: 0.33, h: 0.33, color: '#08102e', label: ZONE_LABELS['scholar_quarter'] },
  market_square:     { x: 0.67, y: 0.33, w: 0.33, h: 0.34, color: '#281f08', label: ZONE_LABELS['market_square'] },
  guard_post:        { x: 0.67, y: 0.67, w: 0.33, h: 0.33, color: '#28080a', label: ZONE_LABELS['guard_post'] },
}

// ── Home zone: where NPCs rest (residential areas) ─────────────────────────
// During resting, NPCs visually move to residential zones, populating them.

const WORK_TO_HOME: Record<string, string> = {
  north_farm:        'residential_west',
  south_farm:        'residential_west',
  workshop_district: 'residential_east',
  market_square:     'residential_east',
  scholar_quarter:   'residential_east',
  plaza:             'residential_east',
  guard_post:        'guard_post',       // guards bunk at their post
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

export function setMapPaused(value: boolean) { _mapPaused = value }

// ── NPC visual state (separate from sim data) ──────────────────────────────

interface NPCVisual {
  x: number        // current canvas-normalised position (0–1)
  y: number
  tx: number       // target position
  ty: number
  moveIn: number   // frames until next target pick
  renderZone: string  // which zone is currently rendered (may differ from sim zone when resting)
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
    if (!z) return { x: npc.x, y: npc.y, tx: npc.x, ty: npc.y, moveIn: 0, renderZone }
    const cx = z.x + npc.x * z.w
    const cy = z.y + npc.y * z.h
    npcVisuals.set(npc.id, { x: cx, y: cy, tx: cx, ty: cy, moveIn: Math.random() * 120 | 0, renderZone })
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

function stepVisual(v: NPCVisual, action: string, workZone: string, family: FamilyCluster | null) {
  if (_mapPaused) return   // freeze animation while game is paused

  const targetZone = getVisualZone(workZone, action)

  // Zone changed (e.g., NPC started resting and should go home):
  // snap to new zone immediately so they don't drift through unrelated zones.
  if (targetZone !== v.renderZone) {
    v.renderZone = targetZone
    const snap = randomPosInZone(targetZone)
    v.x = snap.x
    v.y = snap.y
    v.tx = snap.x
    v.ty = snap.y
    v.moveIn = 0
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
  ctx.fillStyle = '#111'
  ctx.fillRect(0, 0, W, H)

  const world = getWorld?.()
  if (!world) {
    drawPlaceholder(W, H)
    return
  }

  drawZones(W, H)
  drawNPCs(world, W, H)
  drawLegend(W, H)
}

function drawPlaceholder(W: number, H: number) {
  if (!ctx) return
  ctx.fillStyle = '#222'
  ctx.font = '13px system-ui'
  ctx.textAlign = 'center'
  ctx.fillText('Initializing...', W / 2, H / 2)
  ctx.textAlign = 'left'
}

function drawZones(W: number, H: number) {
  if (!ctx) return
  for (const [, zone] of Object.entries(ZONE_LAYOUT)) {
    const px = zone.x * W
    const py = zone.y * H
    const pw = zone.w * W
    const ph = zone.h * H

    ctx.fillStyle = zone.color
    ctx.fillRect(px, py, pw, ph)

    // Slightly thicker, more visible border between zones
    ctx.strokeStyle = '#333'
    ctx.lineWidth = 1.5
    ctx.strokeRect(px, py, pw, ph)

    // Zone label — centered, larger font, higher opacity for readability
    ctx.fillStyle = 'rgba(255,255,255,0.45)'
    ctx.font = 'bold 11px system-ui'
    ctx.textAlign = 'center'
    ctx.fillText(zone.label, px + pw / 2, py + 16)
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
    stepVisual(v, npc.action_state, npc.zone, familyClusters.get(npc.id) ?? null)

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
