import { clamp } from './constitution';
// ── Small-world network builder ─────────────────────────────────────────────
//
// Strong ties: 5–15 neighbors, prefer same zone + same role + close age
// Weak ties:   50–150, same zone + adjacent zones
// Clusters:    Louvain-lite (zone-based community assignment)
//
// Time: O(N × k) per category, acceptable for 10k NPCs
const ZONE_ADJACENCY = {
    north_farm: ['south_farm', 'residential_west', 'plaza'],
    south_farm: ['north_farm', 'residential_east', 'market_square'],
    workshop_district: ['market_square', 'residential_east', 'residential_west'],
    market_square: ['south_farm', 'workshop_district', 'plaza', 'scholar_quarter'],
    scholar_quarter: ['market_square', 'plaza', 'residential_east'],
    residential_east: ['south_farm', 'workshop_district', 'scholar_quarter', 'plaza'],
    residential_west: ['north_farm', 'workshop_district', 'plaza'],
    guard_post: ['plaza', 'residential_east', 'residential_west'],
    plaza: ['market_square', 'scholar_quarter', 'residential_east', 'residential_west', 'guard_post'],
};
function proximityScore(a, b) {
    if (a.id === b.id)
        return -1;
    let score = 0;
    if (a.zone === b.zone)
        score += 3;
    else if (ZONE_ADJACENCY[a.zone]?.includes(b.zone))
        score += 1;
    if (a.role === b.role)
        score += 2;
    const ageDiff = Math.abs(a.age - b.age);
    if (ageDiff < 5)
        score += 2;
    else if (ageDiff < 15)
        score += 1;
    return score;
}
export function buildNetwork(npcs, constitution) {
    const strong = new Map();
    const weak = new Map();
    const clusters = new Map();
    for (const npc of npcs) {
        strong.set(npc.id, new Set());
        weak.set(npc.id, new Set());
    }
    // Cohesion scales neighbor counts
    const cohesion = clamp(constitution.network_cohesion, 0.1, 1);
    const strongTarget = Math.round(5 + cohesion * 10); // 5–15
    const weakTarget = Math.round(50 + cohesion * 100); // 50–150
    // Build candidates per zone for speed
    const byZone = {};
    for (const npc of npcs) {
        if (!byZone[npc.zone])
            byZone[npc.zone] = [];
        byZone[npc.zone].push(npc);
    }
    for (const npc of npcs) {
        // Strong-tie candidates: same zone + adjacent zones
        const sameZone = byZone[npc.zone] ?? [];
        const adjZones = (ZONE_ADJACENCY[npc.zone] ?? []).flatMap(z => byZone[z] ?? []);
        const strongCandidates = [...sameZone, ...adjZones]
            .filter(c => c.id !== npc.id)
            .sort((a, b) => proximityScore(b, npc) - proximityScore(a, npc))
            .slice(0, strongTarget * 3); // keep top 3× so we can sample
        // Add mutual strong ties
        const s = strong.get(npc.id);
        for (const candidate of strongCandidates.slice(0, strongTarget)) {
            if (s.size >= strongTarget)
                break;
            if (proximityScore(candidate, npc) < 0)
                continue;
            s.add(candidate.id);
            strong.get(candidate.id).add(npc.id);
        }
        // Weak ties: same zone + 2-hop adjacent zones (broader)
        const hop2 = (ZONE_ADJACENCY[npc.zone] ?? [])
            .flatMap(z => ZONE_ADJACENCY[z] ?? []);
        const weakCandidates = [
            ...(byZone[npc.zone] ?? []),
            ...(ZONE_ADJACENCY[npc.zone] ?? []).flatMap(z => byZone[z] ?? []),
            ...hop2.flatMap(z => byZone[z] ?? []),
        ].filter(c => c.id !== npc.id && !s.has(c.id));
        const w = weak.get(npc.id);
        for (let i = 0; i < weakCandidates.length && w.size < weakTarget; i++) {
            const idx = Math.floor(Math.random() * weakCandidates.length);
            const candidate = weakCandidates[idx];
            if (candidate && candidate.id !== npc.id) {
                w.add(candidate.id);
                weak.get(candidate.id).add(npc.id);
            }
        }
    }
    // Clusters: zone → cluster id
    const ZONES_LIST = [...new Set(npcs.map(npc => npc.zone))];
    const zoneToCluster = {};
    ZONES_LIST.forEach((z, i) => { zoneToCluster[z] = i; });
    for (const npc of npcs)
        clusters.set(npc.id, zoneToCluster[npc.zone] ?? 0);
    return { strong, weak, clusters };
}
