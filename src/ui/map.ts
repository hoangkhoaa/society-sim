import type { WorldState, Role } from '../types'
import { ZONE_LABELS } from '../types'
import { openSpotlight } from './spotlight'
import type { AIConfig } from '../types'

// ── Zone layout (normalized 0–1 grid, 3×3) ─────────────────────────────────

interface ZoneRect { x: number; y: number; w: number; h: number; color: string; label: string }

const ZONE_LAYOUT: Record<string, ZoneRect> = {
  north_farm:        { x: 0.00, y: 0.00, w: 0.33, h: 0.35, color: '#1a3010', label: ZONE_LABELS['north_farm'] },
  south_farm:        { x: 0.00, y: 0.35, w: 0.33, h: 0.30, color: '#1a3010', label: ZONE_LABELS['south_farm'] },
  residential_west:  { x: 0.00, y: 0.65, w: 0.33, h: 0.35, color: '#1a1a20', label: ZONE_LABELS['residential_west'] },
  workshop_district: { x: 0.33, y: 0.00, w: 0.34, h: 0.40, color: '#201a10', label: ZONE_LABELS['workshop_district'] },
  plaza:             { x: 0.33, y: 0.40, w: 0.34, h: 0.25, color: '#20201a', label: ZONE_LABELS['plaza'] },
  residential_east:  { x: 0.33, y: 0.65, w: 0.34, h: 0.35, color: '#1a1a20', label: ZONE_LABELS['residential_east'] },
  scholar_quarter:   { x: 0.67, y: 0.00, w: 0.33, h: 0.33, color: '#10182a', label: ZONE_LABELS['scholar_quarter'] },
  market_square:     { x: 0.67, y: 0.33, w: 0.33, h: 0.34, color: '#201810', label: ZONE_LABELS['market_square'] },
  guard_post:        { x: 0.67, y: 0.67, w: 0.33, h: 0.33, color: '#1a1010', label: ZONE_LABELS['guard_post'] },
}

// ── Role colors ────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<Role, string> = {
  farmer:    '#5dcaa5',
  craftsman: '#378add',
  merchant:  '#ef9f27',
  scholar:   '#7f77dd',
  guard:     '#e24b4b',
  leader:    '#ffffff',
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
  x: number   // current canvas-normalised position (0–1)
  y: number
  tx: number  // target position
  ty: number
  moveIn: number  // frames until next target pick
}

const npcVisuals = new Map<number, NPCVisual>()

function getOrInitVisual(npc: { id: number; x: number; y: number; zone: string }): NPCVisual {
  if (!npcVisuals.has(npc.id)) {
    const z = ZONE_LAYOUT[npc.zone]
    if (!z) return { x: npc.x, y: npc.y, tx: npc.x, ty: npc.y, moveIn: 0 }
    const cx = z.x + npc.x * z.w
    const cy = z.y + npc.y * z.h
    npcVisuals.set(npc.id, { x: cx, y: cy, tx: cx, ty: cy, moveIn: Math.random() * 120 | 0 })
  }
  return npcVisuals.get(npc.id)!
}

function randomPosInZone(zone: string): { x: number; y: number } {
  const z = ZONE_LAYOUT[zone]
  if (!z) return { x: 0.5, y: 0.5 }
  const margin = 0.02
  return {
    x: z.x + margin + Math.random() * (z.w - margin * 2),
    y: z.y + margin + Math.random() * (z.h - margin * 2),
  }
}

const ACTION_SPEED: Record<string, number> = {
  working:    0.0008,
  resting:    0.0002,
  socializing:0.0014,
  organizing: 0.0018,
  fleeing:    0.003,
  confront:   0.002,
  complying:  0.0006,
}

function stepVisual(v: NPCVisual, action: string, zone: string) {
  if (_mapPaused) return   // freeze animation while game is paused
  v.moveIn--
  if (v.moveIn <= 0) {
    const t = randomPosInZone(zone)
    v.tx = t.x
    v.ty = t.y
    // resting moves rarely; fleeing/socializing moves often
    const freqMap: Record<string, number> = {
      resting: 240, working: 90, socializing: 40,
      organizing: 50, fleeing: 20, confront: 30, complying: 100,
    }
    v.moveIn = (freqMap[action] ?? 90) + (Math.random() * 30 | 0)
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

    ctx.strokeStyle = '#222'
    ctx.lineWidth = 1
    ctx.strokeRect(px, py, pw, ph)

    // Zone label
    ctx.fillStyle = 'rgba(255,255,255,0.18)'
    ctx.font = '9px system-ui'
    ctx.textAlign = 'center'
    ctx.fillText(zone.label, px + pw / 2, py + 14)
    ctx.textAlign = 'left'
  }
}

function drawNPCs(world: WorldState, W: number, H: number) {
  if (!ctx) return

  // Build visual position lookup this frame
  const posMap = new Map<number, { px: number; py: number }>()

  for (const npc of world.npcs) {
    if (!npc.lifecycle.is_alive) continue
    if (!ZONE_LAYOUT[npc.zone]) continue

    const v = getOrInitVisual(npc)
    stepVisual(v, npc.action_state, npc.zone)

    const px = v.x * W
    const py = v.y * H
    posMap.set(npc.id, { px, py })
  }

  // ── Social relationship lines ──────────────────────────────────────────
  // Draw strong-tie lines for socializing/organizing pairs; faint lines when just working
  const drawnPairs = new Set<string>()
  const pulse = 0.5 + 0.5 * Math.sin(frameCount * 0.05)  // 0–1 pulsing

  for (const npc of world.npcs) {
    if (!npc.lifecycle.is_alive) continue
    const aPos = posMap.get(npc.id)
    if (!aPos) continue

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
      if (dist > 120) continue  // only draw lines for nearby pairs

      const isSocializing = npc.action_state === 'socializing' || bNpc.action_state === 'socializing'
      const isOrganizing  = npc.action_state === 'organizing'  || bNpc.action_state === 'organizing'
      const isFleeing     = npc.action_state === 'fleeing'

      let lineColor: string
      let alpha: number

      if (isOrganizing) {
        lineColor = `rgba(239,159,39,${0.3 + pulse * 0.3})`  // amber — mobilising
        alpha = 1
      } else if (isSocializing) {
        lineColor = `rgba(93,202,165,${0.25 + pulse * 0.2})`  // teal — socialising
        alpha = 1
      } else if (isFleeing) {
        lineColor = `rgba(226,75,75,0.15)`  // red dim — panic network
        alpha = 1
      } else {
        lineColor = `rgba(255,255,255,0.05)`  // near-invisible working ties
        alpha = 1
      }

      ctx.beginPath()
      ctx.moveTo(aPos.px, aPos.py)
      ctx.lineTo(bPos.px, bPos.py)
      ctx.strokeStyle = lineColor
      ctx.lineWidth = isSocializing || isOrganizing ? 1 : 0.5
      ctx.globalAlpha = alpha
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
    const radius = isHovered ? 5 : 2.5

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
  const roles: Role[] = ['farmer', 'craftsman', 'merchant', 'scholar', 'guard', 'leader']

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
