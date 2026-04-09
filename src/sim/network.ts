import type { NPC, Constitution, NetworkGraph } from '../types'
import { clamp, ZONE_ADJACENCY } from './constitution'
import { getRegimeProfile } from './regime-config'

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

// ── Global tie caps ───────────────────────────────────────────────────────────
// These are hard maximums — tie lists will never grow beyond these limits.
// Initial targets (set by cohesion) stay within these bounds.
export const MAX_STRONG_TIES = 25
export const MAX_WEAK_TIES   = 200
export const MAX_INFO_TIES   = 60

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

export async function buildNetwork(npcs: NPC[], constitution: Constitution): Promise<NetworkGraph> {
  const strong  = new Map<number, Set<number>>()
  const weak    = new Map<number, Set<number>>()
  const info    = new Map<number, Set<number>>()
  const clusters = new Map<number, number>()

  // Derive regime restrictions once for this build
  const restrictions = getRegimeProfile(constitution).simRestrictions

  for (const npc of npcs) {
    strong.set(npc.id, new Set())
    weak.set(npc.id, new Set())
    info.set(npc.id, new Set())
  }

  // Cohesion scales neighbor counts; regime restrictions further limit them
  const cohesion = clamp(constitution.network_cohesion, 0.1, 1)
  const strongTarget = Math.round(5  + cohesion * 10)   // 5–15 (unchanged — face-to-face)
  const weakTarget   = Math.round(50 + cohesion * 100)  // 50–150 (unchanged — geographic)

  // Build candidates per zone for speed
  const byZone: Record<string, NPC[]> = {}
  for (const npc of npcs) {
    if (!byZone[npc.zone]) byZone[npc.zone] = []
    byZone[npc.zone].push(npc)
  }

  for (const npc of npcs) {
    // Strong-tie candidates: same zone + adjacent zones (always local — not restricted)
    const sameZone = byZone[npc.zone] ?? []
    const adjZones = (ZONE_ADJACENCY[npc.zone] ?? []).flatMap(z => byZone[z] ?? [])
    const strongCandidates = [...sameZone, ...adjZones]
      .filter(c => c.id !== npc.id)
      .sort((a, b) => proximityScore(b, npc) - proximityScore(a, npc))
      .slice(0, strongTarget * 3)   // keep top 3× so we can sample

    // Add mutual strong ties — cap both sides to prevent hub overflow
    const s = strong.get(npc.id)!
    for (const candidate of strongCandidates.slice(0, strongTarget)) {
      if (s.size >= strongTarget) break
      if (proximityScore(candidate, npc) < 0) continue
      s.add(candidate.id)
      // Only add back-link if candidate has room
      const candidateStrong = strong.get(candidate.id)!
      if (candidateStrong.size < strongTarget) candidateStrong.add(npc.id)
    }

    // Weak ties: cross_zone_ties = false means zone-locked (checkpoints/curfew)
    const hop2 = (ZONE_ADJACENCY[npc.zone] ?? [])
      .flatMap(z => ZONE_ADJACENCY[z] ?? [])
    const weakPool = restrictions.cross_zone_ties
      // Free movement: same zone + adjacent + 2-hop
      ? [...(byZone[npc.zone] ?? []),
         ...(ZONE_ADJACENCY[npc.zone] ?? []).flatMap(z => byZone[z] ?? []),
         ...hop2.flatMap(z => byZone[z] ?? [])]
      // Restricted movement: same zone only (no crossing checkpoints)
      : [...(byZone[npc.zone] ?? [])]
    const weakCandidates = shuffle(weakPool.filter(c => c.id !== npc.id && !s.has(c.id)))

    // Fixed: iterate the shuffled list directly (no random-with-replacement)
    const w = weak.get(npc.id)!
    for (const candidate of weakCandidates) {
      if (w.size >= weakTarget) break
      w.add(candidate.id)
      // Only add back-link if candidate has room
      const candidateWeak = weak.get(candidate.id)!
      if (candidateWeak.size < weakTarget) candidateWeak.add(npc.id)
    }
  }

  // Yield after strong/weak tie construction so the browser stays responsive
  await new Promise<void>(resolve => setTimeout(resolve, 0))

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

  // Target info-tie count: scales with cohesion, then capped by regime's info_ties_cap.
  // Censored regimes shrink information networks — fewer people to talk to freely.
  const infoTarget = Math.round((10 + cohesion * 30) * restrictions.info_ties_cap)

  // Pre-shuffle the full NPC list once; each NPC uses a different offset window
  // to sample cross-role info-ties — avoids O(N²) per-NPC shuffles.
  const shuffledAll = shuffle(npcs)

  for (const npc of npcs) {
    // Candidates: same role (primary echo chamber) + cross-role sample.
    // cross_zone_ties = false restricts info ties to same-zone: under curfew/checkpoints,
    // information can only flow within the local community (no digital/cross-district reach).
    const sameRoleCandidates = (byRole[npc.role] ?? [])
      .filter(c => c.id !== npc.id && (restrictions.cross_zone_ties || c.zone === npc.zone))
    // Cross-role: walk the pre-shuffled array from a per-NPC offset instead of re-shuffling
    const halfInfo = Math.ceil(infoTarget * 0.5)
    const crossRoleSample: NPC[] = []
    const offset = (npc.id * 7) % shuffledAll.length
    for (let k = 0; crossRoleSample.length < halfInfo && k < shuffledAll.length; k++) {
      const candidate = shuffledAll[(offset + k) % shuffledAll.length]
      if (candidate.id !== npc.id && candidate.role !== npc.role
          && (restrictions.cross_zone_ties || candidate.zone === npc.zone))
        crossRoleSample.push(candidate)
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
      // Only add back-link if candidate has room
      const candidateInfo = info.get(candidate.id)!
      if (candidateInfo.size < infoTarget) candidateInfo.add(npc.id)
    }
  }

  return { strong, weak, info, clusters }
}
