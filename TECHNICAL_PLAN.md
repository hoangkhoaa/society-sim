# Technical Plan — Society Sim

**Player role**: The Architect — establishes the system via chat, injects events, observes consequences.  
**Core principle**: 10,000 NPCs run rule-based. LLM is used only where judgment is needed.

---

## Stack

| Layer | Tech | Reason |
|-------|------|--------|
| Language | **TypeScript** | Type safety for ~15 complex data models |
| Build | **Vite** | `npx vite` to run, enables SharedArrayBuffer (COOP/COEP headers) |
| Render | PixiJS v8 (WebGL) | 10k sprites, heatmap, 60fps |
| UI | Vanilla HTML/CSS overlay | No framework needed |
| Simulation | TS + Web Worker | Separate thread, SharedArrayBuffer zero-copy |
| AI default | Gemini Flash 2.5 | Free tier, sufficient |
| Entry | `index.html` | `npm run dev` to run, `npm run build` for static files |

**Why TypeScript + Vite instead of vanilla JS:**
- 15+ data models with cross-references → TS catches errors before runtime
- SharedArrayBuffer requires COOP/COEP headers → Vite auto-configures
- Vite overhead: only `package.json` + `vite.config.ts`, no webpack hell
- Output is still static files, deployable on GitHub Pages

---

## File Structure

```
index.html
css/
  main.css
js/
  main.js                   ← entry, wires everything together
  state.js                  ← world state singleton (shared main ↔ worker)
  sim/
    engine.js               ← tick, initWorld, injectEvent, computeMacro
    npc.js                  ← NPC model, update, formulas
    network.js              ← social graph build + propagation
    institutions.js         ← institution state + rule-based behavior
    events.js               ← event queue, effects, cascade triggers
    constitution.js         ← params schema, validation, presets
  ai/
    provider.js             ← unified callAI (Gemini / Anthropic / OpenAI)
    god-agent.js            ← player chat → event / world answer
    institution-agent.js    ← institution LLM decisions
    narrative-agent.js      ← event log writing
  render/
    map.js                  ← PixiJS heatmap + zoom levels
    feed.js                 ← narrative feed DOM
    ui.js                   ← topbar, panels, chat input
  workers/
    sim-worker.js           ← simulation tick loop (Web Worker)
```

---

## Data Models

### Constitution
```javascript
{
  // Economy
  gini_start: 0.31,            // 0=perfectly equal, 1=max inequality
  market_freedom: 0.6,         // 0=command economy, 1=laissez-faire
  resource_scarcity: 0.7,      // 0=abundant, 1=scarce

  // Politics
  state_power: 0.4,            // 0=minimal state, 1=totalitarian
  safety_net: 0.5,             // 0=none, 1=comprehensive
  individual_rights_floor: 0.4,// minimum floor NPC cannot be treated below

  // Society
  base_trust: 0.58,            // initial trust in institutions
  network_cohesion: 0.5,       // 0=fragmented, 1=tight-knit

  // Value priorities (rank 1–4, influences worldview seed)
  value_priority: ['security', 'equality', 'freedom', 'growth'],

  // Role ratios in the population (sum = 1.0)
  role_ratios: {
    farmer:    0.35,
    craftsman: 0.20,
    merchant:  0.15,
    scholar:   0.10,
    guard:     0.10,
    leader:    0.10
  }
}
```

**Presets:**
| | Nordic | Free Market | Planned Economy |
|--|--------|-------------|-----------------|
| gini_start | 0.28 | 0.48 | 0.18 |
| state_power | 0.65 | 0.25 | 0.90 |
| safety_net | 0.80 | 0.20 | 0.75 |
| base_trust | 0.72 | 0.45 | 0.65 |
| market_freedom | 0.55 | 0.90 | 0.15 |
| value_priority | [security,equality,...] | [freedom,growth,...] | [equality,security,...] |

**value_priority → worldview seed:**
```javascript
const VALUE_WORLDVIEW_BIAS = {
  security: { authority_trust: +0.15, risk_tolerance: -0.10, collectivism: +0.05 },
  equality: { collectivism: +0.20, authority_trust: +0.05 },
  freedom:  { risk_tolerance: +0.15, collectivism: -0.10, authority_trust: -0.10 },
  growth:   { time_preference: +0.20, risk_tolerance: +0.10 }
}
// NPC worldview = base + role_bonus + value_bias × (4 - rank) / 10 + gaussian(0, 0.15)
```

---

### NPC
```javascript
{
  id: number,
  name: string,
  age: number,                  // increases each sim-year
  gender: 'male'|'female',

  // Appearance (basic, generated once at init)
  appearance: {
    height:    'short'|'average'|'tall',
    build:     'slim'|'average'|'sturdy',
    hair:      'black'|'brown'|'gray'|'white',
    skin:      'light'|'medium'|'dark',
  },

  // Lifecycle
  lifecycle: {
    is_alive:       boolean,
    death_cause:    'natural'|'accident'|'disease'|'violence'|null,
    death_tick:     number|null,
    spouse_id:      number|null,
    children_ids:   number[],
    fertility:      number,     // 0–1, decreases with age
  },

  // Occupation (more specific than role)
  occupation: string,           // 'Blacksmith', 'Rice Farmer', ...

  // Narrative
  description: string,          // static, template-based at init
  daily_thought: string,        // dynamic, LLM-generated on click or significant event
  last_thought_tick: number,

  zone: string,
  x: number, y: number,

  // Role
  role: 'farmer'|'craftsman'|'scholar'|'merchant'|'guard'|'leader',

  // Needs (0–100, high = high pressure)
  hunger: number,
  exhaustion: number,
  isolation: number,
  fear: number,

  // Worldview (0–1, fixed at init, drifts slowly over time)
  worldview: {
    collectivism: number,    // 0=individualist, 1=collectivist
    authority_trust: number, // 0=anti-authority, 1=obedient
    risk_tolerance: number,  // 0=risk-averse, 1=risk-seeking
    time_preference: number  // 0=short-term, 1=long-term
  },

  // Computed state (updated each tick)
  stress: number,            // f(needs) — nonlinear
  happiness: number,         // f(stress, relative status, memory, trust)
  action_state: 'working'|'resting'|'socializing'|'organizing'|'fleeing'|'complying',

  // Thresholds — fixed at init
  stress_threshold: number,  // stress > this → leaves routine, chooses coping action
  collective_action_threshold: number, // % of neighbors needed to act first
  adaptability: number,      // rate of worldview change (0–1)

  // Memory — 10 most recent events
  memory: [{
    event_id: string,
    type: 'trust_broken'|'helped'|'harmed'|'crisis'|'windfall',
    emotional_weight: number,  // -100 to +100
    tick: number
  }],

  // Social network
  strong_ties: number[],     // 5–15 NPC ids (family, close friends)
  weak_ties: number[],       // 50–150 NPC ids (neighbors, coworkers)
  influence_score: number,   // network centrality — computed after building graph

  // Trust per institution — TWO-DIMENSIONAL
  trust_in: {
    government: { competence: number, intention: number },
    market:     { competence: number, intention: number },
    opposition: { competence: number, intention: number },
    community:  { competence: number, intention: number },
    guard:      { competence: number, intention: number }
  },

  // Cascade mechanics
  wealth: number,            // personal resources
  grievance: number,         // 0–100
  dissonance_acc: number,    // worldview pressure accumulator
  susceptible: boolean       // currently open to worldview change
}
```

---

### Institution
```javascript
{
  id: 'government'|'market'|'opposition'|'community'|'guard',
  name: string,

  resources: number,
  legitimacy: number,        // 0–1, influences public trust
  power: number,             // 0–1, effective power (legitimacy × resources)

  worldview: { collectivism, authority_trust, risk_tolerance, time_preference },

  inbox: Message[],
  sent: Message[],
  decisions: Decision[],     // history

  relations: {
    [institutionId]: {
      trust: number,         // 0–1
      active_deal: Deal | null,
      last_interaction: number  // tick
    }
  },

  // LLM throttle
  last_decided_tick: number,
  decide_interval: number,   // ticks. Default = 720 (30 sim-days)
  force_decide: boolean      // true on major event → overrides interval
}
```

---

### Event
```javascript
{
  id: string,
  type: 'storm'|'drought'|'flood'|'epidemic'|'resource_boom'|'harsh_winter'|
        'trade_offer'|'refugee_wave'|'ideology_import'|'external_threat'|'blockade'|
        'scandal_leak'|'charismatic_npc'|'martyr'|'tech_shift',

  intensity: number,         // 0–1
  zones: string[],
  duration_ticks: number,
  elapsed_ticks: number,

  // Effects per tick (normalized per NPC in zone)
  effects_per_tick: {
    food_stock_delta: number,    // units of food
    stress_delta: number,        // 0–100 scale
    trust_delta: number,         // applied to trust_in.government
    displacement_chance: number  // % NPCs leaving zone per tick
  },

  source: 'player'|'institution'|'natural'|'cascade',
  narrative_open: string,

  // Cascade triggers — checked each tick
  triggers: [{
    condition: (worldState) => boolean,
    spawn: Partial<Event>
  }]
}
```

---

### Message (inter-institution)
```javascript
{
  id: string,
  from: string,
  to: string,               // institution id or 'all'
  channel: 'public'|'private'|'signal'|'rumor',
  type: 'proposal'|'warning'|'commitment'|'info'|'appeal'|'ultimatum',
  content: string,
  public_cover: string,     // what they say to citizens (may differ from content)
  credibility: number,      // sender's track record
  can_leak: boolean,
  tick: number
}
```

---

### WorldState
```javascript
{
  tick: number,             // 1 tick = 1 sim-hour
  day: number,
  year: number,

  constitution: Constitution,
  npcs: NPC[],              // 10,000
  institutions: Institution[],
  active_events: Event[],
  network: NetworkGraph,    // adjacency list

  macro: {
    food: number,           // 0–100 (% of 30-day supply met)
    stability: number,      // 0–100 (weighted composite)
    trust: number,          // avg trust_in.government.intention across population
    gini: number,           // live gini of wealth distribution
    political_pressure: number // 0–100
  },

  narrative_log: NarrativeEntry[],

  // Constitutional drift tracking
  drift_score: number,      // compared against initial params
  crisis_pending: boolean
}
```

---

## Human Simulation Formulas

### 1. NPC Init from Constitution

```javascript
function createNPC(id, constitution) {
  const role = assignRole(id, constitution.role_ratios)

  // Worldview: base + value bias + role bonus + noise
  const value_bias = constitution.value_priority.reduce((acc, val, rank) => {
    const bias = VALUE_WORLDVIEW_BIAS[val]
    const weight = (4 - rank) / 10   // rank 0 = strongest bias
    for (const dim in bias) acc[dim] = (acc[dim] || 0) + bias[dim] * weight
    return acc
  }, {})

  const role_bonus = ROLE_WORLDVIEW_BONUS[role]  // see table below

  const worldview = {
    collectivism:    clamp(0.5 + (value_bias.collectivism||0) + (role_bonus.collectivism||0) + gaussian(0, 0.15), 0, 1),
    authority_trust: clamp(constitution.base_trust + (value_bias.authority_trust||0) + (role_bonus.authority_trust||0) + gaussian(0, 0.20), 0, 1),
    risk_tolerance:  clamp(0.4 + (value_bias.risk_tolerance||0) + (role_bonus.risk_tolerance||0) + gaussian(0, 0.20), 0, 1),
    time_preference: clamp(constitution.safety_net * 0.5 + (value_bias.time_preference||0) + (role_bonus.time_preference||0) + gaussian(0, 0.15), 0, 1),
  }

  // Initial trust from constitution
  const base_trust = constitution.base_trust
  const trust_in = Object.fromEntries(
    ['government','market','opposition','community','guard'].map(inst => [
      inst,
      {
        competence: clamp(base_trust + gaussian(0, 0.1), 0, 1),
        intention:  clamp(base_trust + gaussian(0, 0.1), 0, 1)
      }
    ])
  )

  return {
    id, role,
    name: pickName(),
    age: rand(18, 65),
    zone: assignZone(id),
    x: 0, y: 0,

    hunger:     rand(10, 30),
    exhaustion: rand(10, 30),
    isolation:  rand(5,  25),
    fear:       rand(0,  15),

    worldview,
    stress: 0,           // computed
    happiness: 60,       // computed
    action_state: 'working',

    stress_threshold:             40 + rand(-10, 10),
    collective_action_threshold:  rand(0.10, 0.70),
    adaptability:                 rand(0.1, 0.9),

    memory: [],
    strong_ties: [],     // filled by buildNetwork
    weak_ties: [],
    influence_score: 0,  // filled after buildNetwork

    trust_in,
    wealth: paretoSample(constitution.gini_start),
    grievance: rand(0, 20),
    dissonance_acc: 0,
    susceptible: false
  }
}

const ROLE_WORLDVIEW_BONUS = {
  guard:     { authority_trust: +0.20, risk_tolerance: +0.10 },
  leader:    { authority_trust: +0.10, time_preference: +0.20, collectivism: +0.10 },
  farmer:    { collectivism: +0.10, time_preference: +0.05 },
  scholar:   { risk_tolerance: -0.05, time_preference: +0.15 },
  merchant:  { collectivism: -0.15, risk_tolerance: +0.10 },
  craftsman: {}
}
```

---

### 2. Needs Decay (each tick = 1 sim-hour)

```javascript
function decayNeeds(npc, state) {
  const food_available = state.macro.food > 15
  const violence_active = state.active_events.some(e => e.type === 'riot' || e.type === 'war')

  npc.hunger     += 0.5
  npc.exhaustion += 0.3
  npc.isolation  += 0.2
  npc.fear       += violence_active ? 2.0 : -0.3

  // Reduce by activity
  if (npc.action_state === 'working' && food_available) npc.hunger -= 2.0
  if (npc.action_state === 'resting')                   npc.exhaustion -= 3.0
  if (npc.action_state === 'socializing') {
    npc.isolation -= 2.5
    if (npc.strong_ties.length < 3) npc.isolation += 1.0  // lonely even in a crowd
  }

  npc.hunger     = clamp(npc.hunger,     0, 100)
  npc.exhaustion = clamp(npc.exhaustion, 0, 100)
  npc.isolation  = clamp(npc.isolation,  0, 100)
  npc.fear       = clamp(npc.fear,       0, 100)
}
```

---

### 3. Stress (nonlinear)

```javascript
function computeStress(npc) {
  // Power function: small is OK, large causes panic
  const h = Math.pow(npc.hunger     / 100, 1.6) * 0.35
  const e = Math.pow(npc.exhaustion / 100, 1.3) * 0.20
  const i = Math.pow(npc.isolation  / 100, 1.4) * 0.20
  const f = Math.pow(npc.fear       / 100, 1.8) * 0.25  // fear amplifies most

  // Identity stress: treated below status expectations
  const identity = computeIdentityStress(npc) * 0.10

  return clamp((h + e + i + f + identity) * 100, 0, 100)
}

function computeIdentityStress(npc) {
  // High when: wealth below role expectation, or disrespected
  const role_expected_wealth = ROLE_WEALTH_EXPECTATION[npc.role]
  return Math.max(0, (role_expected_wealth - npc.wealth) / role_expected_wealth)
}
```

---

### 4. Happiness (relative, not absolute)

```javascript
function computeHappiness(npc, state) {
  // Base from inverse stress
  const stress_penalty = npc.stress * 0.55

  // Compare with neighbors — relative deprivation
  const neighbor_avg = avgWealth(npc.weak_ties, state.npcs)
  const relative_status = clamp((npc.wealth - neighbor_avg) / 100, -1, 1) * 12

  // Inequality — sensitive based on worldview
  const inequality_pain = state.macro.gini * (npc.worldview.collectivism * 0.5 + 0.2) * 18

  // Memory effect (recent events)
  const memory_sum = npc.memory.reduce((s, m) => s + m.emotional_weight, 0)
  const memory_effect = clamp(memory_sum / 10, -15, 15)

  // Trust bonus — living in a society you trust
  const avg_trust = Object.values(npc.trust_in)
    .reduce((s, t) => s + (t.competence + t.intention) / 2, 0) / 5
  const trust_bonus = avg_trust * 8

  return clamp(50 - stress_penalty + relative_status - inequality_pain + memory_effect + trust_bonus, 0, 100)
}
```

---

### 5. Action Selection

```javascript
function selectAction(npc, state) {
  // Below threshold: normal routine
  if (npc.stress < npc.stress_threshold) {
    return normalRoutine(npc, state)  // working/resting/socializing by time of day
  }

  const w = npc.worldview
  const gov_trust = (npc.trust_in.government.competence + npc.trust_in.government.intention) / 2
  const perceived_risk = 1 - (state.institutions.find(i => i.id === 'guard').power * 0.7 +
                               state.institutions.find(i => i.id === 'government').power * 0.3)

  const weights = {
    comply:    gov_trust * (1 - npc.stress / 120),
    withdraw:  (1 - w.collectivism) * (npc.stress / 100),
    organize:  w.collectivism * (1 - gov_trust) * (npc.grievance / 100),
    flee:      (1 - w.risk_tolerance) * (npc.fear / 100),
    confront:  w.risk_tolerance * (1 - gov_trust) * perceived_risk * (npc.stress / 100)
  }

  return weightedRandom(weights)
}
```

---

### 6. Grievance Accumulation

```javascript
function updateGrievance(npc, state) {
  let delta = 0

  // Hunger causes discontent
  if (npc.hunger > 60) delta += (npc.hunger - 60) * 0.08

  // Relative deprivation — seeing others have more
  const neighbor_avg = avgWealth(npc.weak_ties, state.npcs)
  if (npc.wealth < neighbor_avg) delta += (neighbor_avg - npc.wealth) / 200

  // Trust broken — large spike
  const recent_betrayal = npc.memory.find(m => m.type === 'trust_broken' && state.tick - m.tick < 720)
  if (recent_betrayal) delta += Math.abs(recent_betrayal.emotional_weight) * 0.05

  // Reduced when helped
  const recent_help = npc.memory.find(m => m.type === 'helped' && state.tick - m.tick < 240)
  if (recent_help) delta -= 4

  // Social support reduces grievance
  delta -= (npc.strong_ties.length / 15) * 1.5

  // Slow decay when conditions improve
  if (npc.happiness > 65) delta -= 0.8

  npc.grievance = clamp(npc.grievance + delta, 0, 100)
}
```

---

### 7. Collective Action — Schelling Threshold

```javascript
function checkCollectiveAction(npc, state) {
  const strong_acting = npc.strong_ties
    .map(id => state.npcs[id])
    .filter(n => ['organize', 'confront'].includes(n.action_state))

  const weak_acting = npc.weak_ties
    .map(id => state.npcs[id])
    .filter(n => n.action_state === 'organize')

  const social_pressure =
    (strong_acting.length / Math.max(npc.strong_ties.length, 1)) * 0.70 +
    (weak_acting.length   / Math.max(npc.weak_ties.length, 1))   * 0.30

  // Perceived risk = f(guard power, government power)
  const guard_power = state.institutions.find(i => i.id === 'guard').power
  const perceived_risk = guard_power * 0.8

  return (
    social_pressure > npc.collective_action_threshold &&
    npc.grievance   > 40 &&
    perceived_risk  < npc.worldview.risk_tolerance
  )
}
```

---

### 8. Perception (same event, heard differently)

```javascript
function perceiveEvent(npc, event, sender_institution_id) {
  const trust = npc.trust_in[sender_institution_id]
  const sender_trust = (trust.competence + trust.intention) / 2

  // Stress amplifies negatives
  const stress_amp = 1 + (npc.stress / 100) * 0.55

  // Trust factor: distrust → amplifies; trust → softens
  const trust_factor = sender_trust < 0.35 ? 1.45
                     : sender_trust > 0.70 ? 0.80
                     : 1.0

  // Worldview alignment: believe what matches your beliefs
  const alignment = eventAlignsWorldview(npc, event)
  const alignment_factor = alignment ? 1.25 : 0.65

  return clamp(event.intensity * stress_amp * trust_factor * alignment_factor, 0, 1)
}
```

---

### 9. Info Distortion through Network

```javascript
function distortMessage(message, sender_npc) {
  const emotional_lean = (sender_npc.grievance - 50) / 100  // -0.5 to +0.5
  const noise = (Math.random() - 0.5) * 0.15

  return {
    severity: clamp(message.severity * 0.85 + emotional_lean * 0.3 + noise, 0, 1),
    // content decay: ~85% of content retained, sender's emotion added
    hops:     message.hops + 1
    // After 4+ hops: original content ~45%, emotion ~55%
  }
}

// Spread speed: negative news × 2 compared to positive news
function spreadSpeed(message) {
  return message.severity > 0.5 ? 2.0 : 1.0
}
```

---

### 10. Trust Update (asymmetric)

```javascript
function updateTrust(npc, institution_id, event_type, magnitude = 1.0) {
  const t = npc.trust_in[institution_id]

  const deltas = {
    promise_kept:    { competence: +0.03, intention: +0.02 },
    crisis_handled:  { competence: +0.05, intention: +0.03 },
    promise_broken:  { competence: -0.06, intention: -0.08 },  // asymmetric
    corruption:      { competence: -0.05, intention: -0.20 },  // intention nearly permanent
    helped_me:       { competence: +0.02, intention: +0.04 },
    harmed_me:       { competence: -0.08, intention: -0.12 },
    silent_in_crisis:{ competence: -0.04, intention: -0.06 }
  }

  const d = deltas[event_type] || { competence: 0, intention: 0 }
  t.competence = clamp(t.competence + d.competence * magnitude, 0, 1)
  t.intention  = clamp(t.intention  + d.intention  * magnitude, 0, 1)

  // Once intention is broken to near 0: recovery capped at 0.35
  // "Once integrity is lost, it is never fully restored"
  if (t.intention < 0.1 && d.intention > 0) {
    t.intention = Math.min(t.intention + d.intention * magnitude, 0.35)
  }
}
```

---

### 11. Worldview Drift (Radicalization)

```javascript
function updateWorldview(npc, state) {
  // Accumulate dissonance
  let d_delta = 0
  if (npc.stress > npc.stress_threshold)
    d_delta += (npc.stress - npc.stress_threshold) * 0.08
  if (npc.memory.some(m => m.type === 'trust_broken' && state.tick - m.tick < 168))
    d_delta += 10
  if (npc.memory.some(m => m.type === 'windfall' && state.tick - m.tick < 72))
    d_delta -= 4
  d_delta -= (npc.strong_ties.length / 15) * 2  // social support is an anchor

  npc.dissonance_acc = clamp(npc.dissonance_acc + d_delta, 0, 100)
  npc.susceptible    = npc.dissonance_acc > 60

  if (!npc.susceptible) return

  // When susceptible: drift toward worldview of most influential strong ties
  const influencers = npc.strong_ties
    .map(id => state.npcs[id])
    .sort((a, b) => b.influence_score - a.influence_score)
    .slice(0, 3)

  for (const dim of ['collectivism', 'authority_trust', 'risk_tolerance', 'time_preference']) {
    const avg_neighbor = influencers.reduce((s, n) => s + n.worldview[dim], 0) / influencers.length
    const pull = (avg_neighbor - npc.worldview[dim]) * npc.adaptability * 0.005
    npc.worldview[dim] = clamp(npc.worldview[dim] + pull, 0, 1)
  }

  // No one reaches them → drift toward cluster extreme (default)
  if (influencers.every(n => n.dissonance_acc < 30)) {
    // stable cluster → pull toward center
  } else {
    // cluster also unstable → mutual radicalization
    for (const dim of ['collectivism', 'authority_trust']) {
      npc.worldview[dim] = npc.worldview[dim] > 0.5
        ? clamp(npc.worldview[dim] + 0.002, 0, 1)
        : clamp(npc.worldview[dim] - 0.002, 0, 1)
    }
  }
}
```

---

### 12. Productivity

```javascript
function computeProductivity(npc, state) {
  const motivation = 0.5 + (npc.happiness / 100) * 0.5

  // Perceived fairness: compensated proportional to contribution?
  const expected = ROLE_WEALTH_EXPECTATION[npc.role]
  const fairness = clamp(npc.wealth / expected, 0, 1.5)
  const fairness_bonus = (fairness - 1.0) * 0.2  // ±20%

  const stress_penalty = npc.stress / 200  // stress=100 → -50%

  return Math.max(0, npc.base_skill * motivation * (1 + fairness_bonus) * (1 - stress_penalty))
}
```

---

### 13. Macro Stats (emerging from individuals)

```javascript
function computeMacroStats(state) {
  const npcs = state.npcs

  // Food: % of needs met
  const daily_production = npcs
    .filter(n => n.role === 'farmer')
    .reduce((s, n) => s + computeProductivity(n, state), 0) / 1000
  state.food_stock = clamp((state.food_stock || 50) + daily_production - npcs.length, 0, 99999)
  const food = clamp(state.food_stock / (npcs.length * 30) * 100, 0, 100)

  // Gini (live)
  const wealths = npcs.map(n => n.wealth).sort((a, b) => a - b)
  const gini = computeGini(wealths)

  // Political pressure
  const political_pressure = clamp(
    npcs.filter(n => ['organize','confront','flee'].includes(n.action_state)).length
    / npcs.length * 200, 0, 100
  )

  // Trust (avg government intention — reflects legitimacy)
  const trust = npcs.reduce((s, n) => s + n.trust_in.government.intention, 0) / npcs.length * 100

  // Stability (weighted composite)
  const avg_trust_gov = npcs.reduce((s, n) =>
    s + (n.trust_in.government.competence + n.trust_in.government.intention) / 2, 0) / npcs.length
  const cohesion = 1 - (npcs.filter(n => n.action_state === 'flee').length / npcs.length)
  const avg_stress = npcs.reduce((s, n) => s + n.stress, 0) / npcs.length
  const stability = clamp(
    avg_trust_gov * 30 +
    cohesion * 20 +
    (food / 100) * 25 +
    (1 - avg_stress / 100) * 15 +
    (1 - political_pressure / 100) * 10,
    0, 100
  )

  return { food, gini, political_pressure, trust, stability }
}
```

---

### 14. Constitutional Crisis Trigger

```javascript
function computeDriftScore(state) {
  const C = state.constitution
  const m = state.macro

  return (
    Math.abs(m.gini    - C.gini_start)   * 2.0 +
    Math.abs(m.trust   - C.base_trust * 100) / 100 * 1.5 +
    (m.political_pressure > 70 ? 0.20 : 0) +
    (m.stability < 30 ? 0.15 : 0)
  )
  // Crisis when drift > 0.35 for 30+ consecutive days
}
```

---

## Network Building

```javascript
function buildNetwork(npcs, constitution) {
  const graph = new Map()  // npcId → { strong: Set, weak: Set }

  for (const npc of npcs) {
    graph.set(npc.id, { strong: new Set(), weak: new Set() })
  }

  for (const npc of npcs) {
    // STRONG TIES: same zone + same/similar role → family, close colleagues
    const same_zone = npcs.filter(n => n.id !== npc.id && n.zone === npc.zone)
    const same_role = same_zone.filter(n => n.role === npc.role)
    const diff_role = same_zone.filter(n => n.role !== npc.role)

    // Prioritize same role, fill with different role
    const strong_pool = [...same_role, ...diff_role]
    const strong_count = Math.floor(rand(5, 15) * constitution.network_cohesion + 3)
    const strong = pickRandom(strong_pool, Math.min(strong_count, strong_pool.length))
    strong.forEach(n => {
      graph.get(npc.id).strong.add(n.id)
      graph.get(n.id).strong.add(npc.id)  // bidirectional
    })

    // WEAK TIES: adjacent zones + some random long-distance
    const adjacent = npcs.filter(n => n.id !== npc.id && isAdjacentZone(n.zone, npc.zone))
    const random_long = pickRandom(npcs.filter(n => !isAdjacentZone(n.zone, npc.zone)), 10)
    const weak_pool = [...adjacent, ...random_long]
    const weak_count = Math.floor(rand(50, 150) * constitution.network_cohesion + 20)
    pickRandom(weak_pool, Math.min(weak_count, weak_pool.length))
      .forEach(n => {
        graph.get(npc.id).weak.add(n.id)
        // weak ties not necessarily bidirectional
      })
  }

  // Compute influence_score = normalized degree centrality
  for (const npc of npcs) {
    const ties = graph.get(npc.id)
    npc.influence_score = (ties.strong.size * 3 + ties.weak.size) / (15 * 3 + 150)
    npc.strong_ties = [...ties.strong]
    npc.weak_ties   = [...ties.weak]
  }

  return graph
}
```

---

## AI Integration

### Provider System
```javascript
// ai/provider.js
const PROVIDERS = {
  gemini: {
    defaultModel: 'gemini-2.5-flash',
    url: (model, key) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    buildBody: (system, user) => ({
      system_instruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }]
    }),
    parseResponse: (json) => json.candidates[0].content.parts[0].text,
    authInUrl: true  // key in URL, not header
  },
  anthropic: {
    defaultModel: 'claude-haiku-4-5-20251001',
    url: () => 'https://api.anthropic.com/v1/messages',
    headers: (key) => ({ 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }),
    buildBody: (system, user, model) => ({ model, max_tokens: 1024, system, messages: [{ role: 'user', content: user }] }),
    parseResponse: (json) => json.content[0].text
  },
  openai: {
    defaultModel: 'gpt-4o-mini',
    url: () => 'https://api.openai.com/v1/chat/completions',
    headers: (key) => ({ 'Authorization': `Bearer ${key}`, 'content-type': 'application/json' }),
    buildBody: (system, user, model) => ({ model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
    parseResponse: (json) => json.choices[0].message.content
  }
}

async function callAI(config, systemPrompt, userMessage, opts = {}) {
  const p = PROVIDERS[config.provider]
  const model = config.model || p.defaultModel
  const url = p.url(model, config.key)
  const headers = p.authInUrl ? { 'content-type': 'application/json' } : p.headers(config.key)
  const body = p.buildBody(systemPrompt, userMessage, model)

  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
  if (!res.ok) throw new Error(`AI call failed: ${res.status}`)
  return p.parseResponse(await res.json())
}
```

### God Agent
```javascript
// ai/god-agent.js

// God Agent state (persists for session)
const godState = {
  conversation_history: [],   // full history for agent memory
  constitution: null,         // set after setup is complete
  world_setup_done: false
}

async function setupWorld(aiConfig, onMessage) {
  // First conversation → extract constitution
  // onMessage(text) streams each part to the UI
  // Returns Constitution object when user confirms
}

async function handlePlayerChat(message, worldState, aiConfig) {
  godState.conversation_history.push({ role: 'user', content: message })

  const context = buildWorldContext(worldState)  // ~400 tokens

  const response = await callAI(
    aiConfig,
    GOD_SYSTEM_PROMPT,
    `WORLD STATE:\n${context}\n\nPLAYER: ${message}`
  )

  godState.conversation_history.push({ role: 'assistant', content: response })

  // Parse JSON from response
  const parsed = JSON.parse(extractJSON(response))
  return parsed  // GodResponse object
}

function buildWorldContext(state) {
  // Compress: only send what the agent needs
  return JSON.stringify({
    day: state.day, year: state.year,
    macro: state.macro,
    active_events: state.active_events.map(e => ({ type: e.type, intensity: e.intensity, zone: e.zones })),
    institutions: state.institutions.map(i => ({
      id: i.id, legitimacy: i.legitimacy, resources: i.resources,
      last_decision: i.decisions.at(-1)?.action
    })),
    stress_distribution: computeStressDistribution(state.npcs),  // histogram
    top_grievances: getTopGrievanceGroups(state.npcs)             // top 3 most discontented groups
  })
}
```

### Rate Limiting
```javascript
const AI_SCHEDULE = {
  god_agent:           'on_demand',          // every player message
  institution_decide:  'every_720_ticks',    // 30 sim-days, or when force_decide=true
  narrative:           'on_significant',     // stress spike >15, cascade, player event
  npc_monologue:       'on_click'            // when player clicks an NPC
}

// Significant event threshold:
function isSignificant(event, state) {
  return (
    event.source === 'player' ||
    event.source === 'cascade' ||
    state.macro.stability < 25 ||
    event.intensity > 0.7
  )
}

// Token estimate per sim-hour (real time):
// God agent:        ~1500 tokens × ~3 calls = 4,500
// Institutions:     ~1200 tokens × ~2 calls = 2,400
// Narrative:        ~400 tokens  × ~5 calls = 2,000
// Total: ~9k tokens/hour → Gemini free: 1M tokens/day → sufficient
```

---

## Web Worker Architecture

```javascript
// ── Main → Worker ─────────────────────────────────────
worker.postMessage({ type: 'INIT',             constitution })
worker.postMessage({ type: 'INJECT_EVENT',     event })
worker.postMessage({ type: 'SET_SPEED',        speed })  // 1|3|10|max
worker.postMessage({ type: 'INST_DECISION',    decision, institution_id })
// ↑ main thread calls LLM, sends result back to worker

// ── Worker → Main ─────────────────────────────────────
// Each tick: send diffs only
self.postMessage({
  type: 'TICK',
  day, year,
  macro,
  npc_diffs: [{ id, stress, action_state, x, y, grievance }],  // only changed NPCs
  new_cascade_events: []
})

// On significant event:
self.postMessage({
  type: 'SIGNIFICANT_EVENT',
  event,
  institutions_to_decide: ['government', 'market']  // who needs to react
})
// → Main thread receives → calls LLM for each institution → sends INST_DECISION back to worker

// On constitutional crisis:
self.postMessage({ type: 'CONSTITUTIONAL_CRISIS', drift_score, institution_demands })
```

---

## Render — PixiJS Map

```javascript
// 3 zoom levels
// zoom < 0.4:  heatmap only — RenderTexture, updates every 10 ticks
// zoom 0.4-0.7: cluster mode — 1 sprite per zone-group
// zoom > 0.7:  individual NPCs in viewport only

// Heatmap color mapping (avg stress per zone):
// stress 0–25:  #2a5820 (green — calm)
// stress 25–45: #8a7a30 (yellow — stress)
// stress 45–65: #8a3020 (red — unrest)
// stress 65–85: #502080 (purple — radicalize)
// stress 85+:   #101010 (black — collapse)

// Event epicenter: ripple animation on inject
// Flow arrows: direction of NPC movement in zone
```

---

## Build Order

### Phase 1 — Can Talk to the World
- [x] `index.html` layout (topbar + map placeholder + feed + chat)
- [x] `css/main.css` dark theme
- [x] `ai/provider.js` — callAI for 3 providers
- [x] `ai/god-agent.js` — setupWorld + handlePlayerChat
- [x] `sim/constitution.js` — schema + presets + validation
- [x] Chat UI: enter key, onboarding conversation, world init
- [x] **Milestone**: enter Gemini key, chat to create constitution, sim initializes

### Phase 2 — Living Simulation
- [x] `sim/npc.js` — createNPC, full formulas (1–13)
- [x] `sim/network.js` — buildNetwork
- [x] `sim/events.js` — event queue + effects
- [x] `sim/engine.js` — tick, initWorld, injectEvent, computeMacroStats
- [x] `workers/sim-worker.js` — tick loop + messaging
- [x] `render/map.js` — basic PixiJS heatmap
- [x] **Milestone**: sim runs 1k NPCs, heatmap shows stress, inject event from chat

### Phase 3 — Institutions + Narrative
- [ ] `sim/institutions.js` — rule-based behavior
- [ ] `ai/institution-agent.js` — LLM decisions
- [ ] `ai/narrative-agent.js` — event log writing
- [ ] `render/feed.js` — narrative feed UI
- [ ] Inter-institution communication
- [ ] **Milestone**: institutions react to events, narrative feed live

### Phase 4 — Scale + Polish
- [ ] Scale to 10k NPCs (Worker optimization)
- [ ] PixiJS zoom levels (heatmap → clusters → individuals)
- [ ] NPC spotlight + LLM monologue
- [ ] Constitutional crisis screen
- [ ] **Milestone**: 10k NPCs smooth, constitutional crisis triggers
