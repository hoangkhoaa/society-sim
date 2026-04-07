import type { NPC, Constitution, NetworkGraph } from '../types'
import { clamp, ZONE_ADJACENCY } from './constitution'

// ── Small-world network builder ─────────────────────────────────────────────
//
// Strong ties:   5–15 neighbors, prefer same zone + same role + close age
//               → direct face-to-face social connections
// Weak ties:     50–150, same zone + adjacent zones
//               → geographic acquaintances
// Info ties:     10–40, based on worldview similarity + role + community
//               → information network (social media, messaging groups, shared interests)
//               → transcends geography; creates ideological echo chambers
// Clusters:      Louvain-lite (zone-based community assignment)
//
// Time: O(N × k) per category, acceptable for 10k NPCs

// ZONE_ADJACENCY is imported from constitution.ts (single source of truth)

// ── Info-network similarity score ───────────────────────────────────────────
// Info ties connect NPCs with similar worldviews, same role, or same community group.
// Geographic proximity does NOT matter — this models digital/social-media connections.

function infoAffinityScore(a: NPC, b: NPC): number {
  if (a.id === b.id) return -1

  let score = 0

  // Worldview similarity (each dimension contributes)
  const collectivismDiff = Math.abs(a.worldview.collectivism - b.worldview.collectivism)
  const authorityDiff    = Math.abs(a.worldview.authority_trust - b.worldview.authority_trust)
  const riskDiff         = Math.abs(a.worldview.risk_tolerance - b.worldview.risk_tolerance)
  if (collectivismDiff < 0.15) score += 3
  else if (collectivismDiff < 0.30) score += 1
  if (authorityDiff < 0.15) score += 2
  else if (authorityDiff < 0.30) score += 1
  if (riskDiff < 0.20) score += 1

  // Same role: people in the same profession follow the same online spaces
  if (a.role === b.role) score += 3

  // Same community group: explicit group membership creates direct info ties
  if (a.community_group !== null && a.community_group === b.community_group) score += 4

  // Similar wealth bracket: class-based information bubbles
  const wealthRatio = Math.max(a.wealth, b.wealth) / (Math.min(a.wealth, b.wealth) + 1)
  if (wealthRatio < 1.5) score += 1

  return score
}

function proximityScore(a: NPC, b: NPC): number {
  if (a.id === b.id) return -1

  let score = 0
  if (a.zone === b.zone) score += 3
  else if (ZONE_ADJACENCY[a.zone]?.includes(b.zone)) score += 1

  if (a.role === b.role) score += 2

  const ageDiff = Math.abs(a.age - b.age)
  if (ageDiff < 5) score += 2
  else if (ageDiff < 15) score += 1

  return score
}

// ── Fisher-Yates shuffle (uniform random permutation) ──────────────────────

function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export function buildNetwork(npcs: NPC[], constitution: Constitution): NetworkGraph {
  const strong  = new Map<number, Set<number>>()
  const weak    = new Map<number, Set<number>>()
  const info    = new Map<number, Set<number>>()
  const clusters = new Map<number, number>()

  for (const npc of npcs) {
    strong.set(npc.id, new Set())
    weak.set(npc.id, new Set())
    info.set(npc.id, new Set())
  }

  // Cohesion scales neighbor counts
  const cohesion = clamp(constitution.network_cohesion, 0.1, 1)
  const strongTarget = Math.round(5  + cohesion * 10)   // 5–15
  const weakTarget   = Math.round(50 + cohesion * 100)  // 50–150

  // Build candidates per zone for speed
  const byZone: Record<string, NPC[]> = {}
  for (const npc of npcs) {
    if (!byZone[npc.zone]) byZone[npc.zone] = []
    byZone[npc.zone].push(npc)
  }

  for (const npc of npcs) {
    // Strong-tie candidates: same zone + adjacent zones
    const sameZone = byZone[npc.zone] ?? []
    const adjZones = (ZONE_ADJACENCY[npc.zone] ?? []).flatMap(z => byZone[z] ?? [])
    const strongCandidates = [...sameZone, ...adjZones]
      .filter(c => c.id !== npc.id)
      .sort((a, b) => proximityScore(b, npc) - proximityScore(a, npc))
      .slice(0, strongTarget * 3)   // keep top 3× so we can sample

    // Add mutual strong ties
    const s = strong.get(npc.id)!
    for (const candidate of strongCandidates.slice(0, strongTarget)) {
      if (s.size >= strongTarget) break
      if (proximityScore(candidate, npc) < 0) continue
      s.add(candidate.id)
      strong.get(candidate.id)!.add(npc.id)
    }

    // Weak ties: same zone + 2-hop adjacent zones (broader)
    const hop2 = (ZONE_ADJACENCY[npc.zone] ?? [])
      .flatMap(z => ZONE_ADJACENCY[z] ?? [])
    const weakCandidates = [
      ...(byZone[npc.zone] ?? []),
      ...(ZONE_ADJACENCY[npc.zone] ?? []).flatMap(z => byZone[z] ?? []),
      ...hop2.flatMap(z => byZone[z] ?? []),
    ].filter(c => c.id !== npc.id && !s.has(c.id))

    const w = weak.get(npc.id)!
    for (let i = 0; i < weakCandidates.length && w.size < weakTarget; i++) {
      const idx = Math.floor(Math.random() * weakCandidates.length)
      const candidate = weakCandidates[idx]
      if (candidate && candidate.id !== npc.id) {
        w.add(candidate.id)
        weak.get(candidate.id)!.add(npc.id)
      }
    }
  }

  // Clusters: zone → cluster id
  const ZONES_LIST = [...new Set(npcs.map(npc => npc.zone))]
  const zoneToCluster: Record<string, number> = {}
  ZONES_LIST.forEach((z, i) => { zoneToCluster[z] = i })
  for (const npc of npcs) clusters.set(npc.id, zoneToCluster[npc.zone] ?? 0)

  // Info ties: worldview-similarity + role + community — NOT geographic
  // Build by-role index for efficient candidate lookup
  const byRole: Record<string, NPC[]> = {}
  for (const npc of npcs) {
    if (!byRole[npc.role]) byRole[npc.role] = []
    byRole[npc.role].push(npc)
  }

  // Target info-tie count scales with network cohesion (10–40)
  const infoTarget = Math.round(10 + cohesion * 30)

  // Pre-shuffle the full NPC list once; each NPC uses a different offset window
  // to sample cross-role info-ties — avoids O(N²) per-NPC shuffles.
  const shuffledAll = shuffle(npcs)

  for (const npc of npcs) {
    // Candidates: same role (primary echo chamber) + a uniformly random cross-role sample
    const sameRoleCandidates = (byRole[npc.role] ?? []).filter(c => c.id !== npc.id)
    // Cross-role: walk the pre-shuffled array from a per-NPC offset instead of re-shuffling
    const halfInfo = Math.ceil(infoTarget * 0.5)
    const crossRoleSample: NPC[] = []
    const offset = (npc.id * 7) % shuffledAll.length
    for (let k = 0; crossRoleSample.length < halfInfo && k < shuffledAll.length; k++) {
      const candidate = shuffledAll[(offset + k) % shuffledAll.length]
      if (candidate.id !== npc.id && candidate.role !== npc.role) crossRoleSample.push(candidate)
    }

    const infoCandidates = [...sameRoleCandidates, ...crossRoleSample]
      .filter(c => c.id !== npc.id)
      .sort((a, b) => infoAffinityScore(b, npc) - infoAffinityScore(a, npc))
      .slice(0, infoTarget * 3)

    const inf = info.get(npc.id)!
    for (const candidate of infoCandidates) {
      if (inf.size >= infoTarget) break
      if (infoAffinityScore(candidate, npc) <= 0) continue
      inf.add(candidate.id)
      info.get(candidate.id)!.add(npc.id)
    }
  }

  return { strong, weak, info, clusters }
}
