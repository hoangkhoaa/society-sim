import { ZONE_LABELS } from '../types';
import { openSpotlight } from './spotlight';
// ── Zone layout (normalized 0–1 grid, 3×3) ─────────────────────────────────
const ZONE_LAYOUT = {
    north_farm:        { x: 0.00, y: 0.00, w: 0.33, h: 0.35, color: '#1a3010', label: ZONE_LABELS['north_farm'] },
    south_farm:        { x: 0.00, y: 0.35, w: 0.33, h: 0.30, color: '#1a3010', label: ZONE_LABELS['south_farm'] },
    residential_west:  { x: 0.00, y: 0.65, w: 0.33, h: 0.35, color: '#1a1a20', label: ZONE_LABELS['residential_west'] },
    workshop_district: { x: 0.33, y: 0.00, w: 0.34, h: 0.40, color: '#201a10', label: ZONE_LABELS['workshop_district'] },
    plaza:             { x: 0.33, y: 0.40, w: 0.34, h: 0.25, color: '#20201a', label: ZONE_LABELS['plaza'] },
    residential_east:  { x: 0.33, y: 0.65, w: 0.34, h: 0.35, color: '#1a1a20', label: ZONE_LABELS['residential_east'] },
    scholar_quarter:   { x: 0.67, y: 0.00, w: 0.33, h: 0.33, color: '#10182a', label: ZONE_LABELS['scholar_quarter'] },
    market_square:     { x: 0.67, y: 0.33, w: 0.33, h: 0.34, color: '#201810', label: ZONE_LABELS['market_square'] },
    guard_post:        { x: 0.67, y: 0.67, w: 0.33, h: 0.33, color: '#1a1010', label: ZONE_LABELS['guard_post'] },
};
// ── Role colors ────────────────────────────────────────────────────────────
const ROLE_COLORS = {
    farmer:    '#5dcaa5',
    craftsman: '#378add',
    merchant:  '#ef9f27',
    scholar:   '#7f77dd',
    guard:     '#e24b4b',
    leader:    '#ffffff',
};
// ── Map state ──────────────────────────────────────────────────────────────
let canvas = null;
let ctx = null;
let getWorld = null;
let getConfig = null;
let animFrame = null;
let hoveredNPCId = null;
// ── Init ───────────────────────────────────────────────────────────────────
export function initMap(canvasEl, worldGetter, configGetter) {
    canvas  = canvasEl;
    ctx     = canvasEl.getContext('2d');
    getWorld  = worldGetter;
    getConfig = configGetter;
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('click',     onClick);
    canvas.addEventListener('mouseleave', () => { hoveredNPCId = null; });
    if (animFrame !== null)
        cancelAnimationFrame(animFrame);
    drawLoop();
}
function resizeCanvas() {
    if (!canvas)
        return;
    const container = canvas.parentElement;
    if (!container)
        return;
    canvas.width  = container.clientWidth;
    canvas.height = container.clientHeight;
}
// ── Draw loop ──────────────────────────────────────────────────────────────
function drawLoop() {
    draw();
    animFrame = requestAnimationFrame(drawLoop);
}
function draw() {
    if (!ctx || !canvas)
        return;
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, W, H);
    const world = getWorld?.();
    if (!world) {
        drawPlaceholder(W, H);
        return;
    }
    drawZones(W, H);
    drawNPCs(world, W, H);
    drawLegend(H);
}
function drawPlaceholder(W, H) {
    if (!ctx)
        return;
    ctx.fillStyle = '#222';
    ctx.font = '13px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('Initializing...', W / 2, H / 2);
    ctx.textAlign = 'left';
}
function drawZones(W, H) {
    if (!ctx)
        return;
    for (const [, zone] of Object.entries(ZONE_LAYOUT)) {
        const px = zone.x * W;
        const py = zone.y * H;
        const pw = zone.w * W;
        const ph = zone.h * H;
        ctx.fillStyle = zone.color;
        ctx.fillRect(px, py, pw, ph);
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 1;
        ctx.strokeRect(px, py, pw, ph);
        // Zone label
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.font = '9px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(zone.label, px + pw / 2, py + 14);
        ctx.textAlign = 'left';
    }
}
function drawNPCs(world, W, H) {
    if (!ctx)
        return;
    for (const npc of world.npcs) {
        if (!npc.lifecycle.is_alive)
            continue;
        const zoneRect = ZONE_LAYOUT[npc.zone];
        if (!zoneRect)
            continue;
        // Map npc.x/y (0–1 within zone) to canvas coordinates
        const px = (zoneRect.x + npc.x * zoneRect.w) * W;
        const py = (zoneRect.y + npc.y * zoneRect.h) * H;
        const color = ROLE_COLORS[npc.role];
        const isHovered = npc.id === hoveredNPCId;
        const radius = isHovered ? 5 : 3;
        // Stress ring
        if (npc.stress > 60) {
            ctx.beginPath();
            ctx.arc(px, py, radius + 3, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(226,75,75,${(npc.stress - 60) / 40 * 0.6})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fillStyle = isHovered ? '#fff' : color;
        ctx.fill();
        // Name label on hover
        if (isHovered) {
            const label = `${npc.name} (${npc.role})`;
            const textW = ctx.measureText(label).width;
            const bx = Math.min(px - textW / 2 - 4, W - textW - 12);
            const by = py - 22;
            ctx.fillStyle = 'rgba(0,0,0,0.85)';
            ctx.fillRect(bx, by, textW + 8, 16);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 10px system-ui';
            ctx.textAlign = 'left';
            ctx.fillText(label, bx + 4, by + 11);
        }
    }
}
function drawLegend(H) {
    if (!ctx)
        return;
    const roles = ['farmer', 'craftsman', 'merchant', 'scholar', 'guard', 'leader'];
    const startX = 8;
    let x = startX;
    const y = H - 8;
    ctx.font = '9px system-ui';
    ctx.textAlign = 'left';
    for (const role of roles) {
        ctx.beginPath();
        ctx.arc(x + 4, y - 4, 4, 0, Math.PI * 2);
        ctx.fillStyle = ROLE_COLORS[role];
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        const label = role.charAt(0).toUpperCase() + role.slice(1);
        ctx.fillText(label, x + 11, y);
        x += ctx.measureText(label).width + 22;
    }
}
// ── Interaction ────────────────────────────────────────────────────────────
function getNPCAtPosition(world, mx, my, W, H) {
    let closest = null;
    let closestDist = 12; // px hit-radius
    for (const npc of world.npcs) {
        if (!npc.lifecycle.is_alive)
            continue;
        const zoneRect = ZONE_LAYOUT[npc.zone];
        if (!zoneRect)
            continue;
        const px = (zoneRect.x + npc.x * zoneRect.w) * W;
        const py = (zoneRect.y + npc.y * zoneRect.h) * H;
        const d = Math.sqrt((px - mx) ** 2 + (py - my) ** 2);
        if (d < closestDist) {
            closestDist = d;
            closest = npc.id;
        }
    }
    return closest;
}
function onMouseMove(e) {
    if (!canvas)
        return;
    const world = getWorld?.();
    if (!world)
        return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    hoveredNPCId = getNPCAtPosition(world, mx, my, canvas.width, canvas.height);
    canvas.style.cursor = hoveredNPCId !== null ? 'pointer' : 'default';
}
function onClick(e) {
    if (!canvas)
        return;
    const world  = getWorld?.();
    const config = getConfig?.();
    if (!world || !config)
        return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const npcId = getNPCAtPosition(world, mx, my, canvas.width, canvas.height);
    if (npcId !== null) {
        const npc = world.npcs[npcId];
        if (npc)
            openSpotlight(npc, world, config);
    }
}
