# Technical Plan — Society Sim

**Player role**: The Architect — thiết lập hệ thống qua chat, inject event, quan sát hậu quả.  
**Core principle**: 10,000 NPC chạy rule-based. LLM chỉ ở nơi cần judgment.

---

## Stack

| Layer | Tech | Lý do |
|-------|------|-------|
| Language | **TypeScript** | Type safety cho ~15 data models phức tạp |
| Build | **Vite** | `npx vite` là chạy, enable SharedArrayBuffer (COOP/COEP headers) |
| Render | PixiJS v8 (WebGL) | 10k sprites, heatmap, 60fps |
| UI | Vanilla HTML/CSS overlay | Không cần framework |
| Simulation | TS + Web Worker | Tách thread, SharedArrayBuffer zero-copy |
| AI default | Gemini Flash 2.5 | Free tier, đủ dùng |
| Entry | `index.html` | `npm run dev` để chạy, `npm run build` ra static files |

**Tại sao TypeScript + Vite thay vì vanilla JS:**
- 15+ data models với cross-references → TS bắt lỗi trước runtime
- SharedArrayBuffer cần COOP/COEP headers → Vite tự config
- Vite overhead: chỉ `package.json` + `vite.config.ts`, không webpack hell
- Output vẫn là static files, deploy được trên GitHub Pages

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
  // Kinh tế
  gini_start: 0.31,            // 0=perfectly equal, 1=max inequality
  market_freedom: 0.6,         // 0=command economy, 1=laissez-faire
  resource_scarcity: 0.7,      // 0=abundant, 1=scarce

  // Chính trị
  state_power: 0.4,            // 0=minimal state, 1=totalitarian
  safety_net: 0.5,             // 0=none, 1=comprehensive
  individual_rights_floor: 0.4,// mức tối thiểu NPC không thể bị vi phạm

  // Xã hội
  base_trust: 0.58,            // trust ban đầu vào institutions
  network_cohesion: 0.5,       // 0=fragmented, 1=tight-knit

  // Giá trị ưu tiên (xếp hạng 1–4, ảnh hưởng worldview seed)
  value_priority: ['security', 'equality', 'freedom', 'growth'],

  // Tỉ lệ role trong dân số (tổng = 1.0)
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
| | Bắc Âu | Tư bản | XHCN |
|--|--------|--------|------|
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
  age: number,                  // tăng mỗi năm sim
  gender: 'male'|'female',

  // Ngoại hình (cơ bản, generate 1 lần lúc init)
  appearance: {
    height:    'short'|'average'|'tall',
    build:     'slim'|'average'|'sturdy',
    hair:      'black'|'brown'|'gray'|'white',
    skin:      'light'|'medium'|'dark',
  },

  // Vòng đời
  lifecycle: {
    is_alive:       boolean,
    death_cause:    'natural'|'accident'|'disease'|'violence'|null,
    death_tick:     number|null,
    spouse_id:      number|null,
    children_ids:   number[],
    fertility:      number,     // 0–1, giảm theo tuổi
  },

  // Nghề nghiệp (cụ thể hơn role)
  occupation: string,           // 'Thợ rèn', 'Nông dân trồng lúa', ...

  // Narrative
  description: string,          // static, template-based lúc init
  daily_thought: string,        // dynamic, LLM generate khi click hoặc significant event
  last_thought_tick: number,

  zone: string,
  x: number, y: number,

  // Role
  role: 'farmer'|'craftsman'|'scholar'|'merchant'|'guard'|'leader',

  // Needs (0–100, cao = áp lực cao)
  hunger: number,
  exhaustion: number,
  isolation: number,
  fear: number,

  // Worldview (0–1, fixed tại init, drift chậm theo thời gian)
  worldview: {
    collectivism: number,    // 0=individualist, 1=collectivist
    authority_trust: number, // 0=anti-authority, 1=obedient
    risk_tolerance: number,  // 0=risk-averse, 1=risk-seeking
    time_preference: number  // 0=short-term, 1=long-term
  },

  // Computed state (cập nhật mỗi tick)
  stress: number,            // f(needs) — nonlinear
  happiness: number,         // f(stress, relative status, memory, trust)
  action_state: 'working'|'resting'|'socializing'|'organizing'|'fleeing'|'complying',

  // Thresholds — cố định từ init
  stress_threshold: number,  // stress > này → rời routine, chọn coping action
  collective_action_threshold: number, // % hàng xóm cần hành động trước
  adaptability: number,      // tốc độ thay đổi worldview (0–1)

  // Memory — 10 events gần nhất
  memory: [{
    event_id: string,
    type: 'trust_broken'|'helped'|'harmed'|'crisis'|'windfall',
    emotional_weight: number,  // -100 đến +100
    tick: number
  }],

  // Social network
  strong_ties: number[],     // 5–15 NPC ids (gia đình, bạn thân)
  weak_ties: number[],       // 50–150 NPC ids (hàng xóm, đồng nghiệp)
  influence_score: number,   // network centrality — computed sau khi build graph

  // Trust per institution — HAI CHIỀU
  trust_in: {
    government: { competence: number, intention: number },
    market:     { competence: number, intention: number },
    opposition: { competence: number, intention: number },
    community:  { competence: number, intention: number },
    guard:      { competence: number, intention: number }
  },

  // Cascade mechanics
  wealth: number,            // tài nguyên cá nhân
  grievance: number,         // 0–100
  dissonance_acc: number,    // worldview pressure accumulator
  susceptible: boolean       // đang dễ bị thay đổi worldview
}
```

---

### Institution
```javascript
{
  id: 'government'|'market'|'opposition'|'community'|'guard',
  name: string,

  resources: number,
  legitimacy: number,        // 0–1, ảnh hưởng trust của dân
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
  decide_interval: number,   // ticks. Mặc định = 720 (30 ngày sim)
  force_decide: boolean      // true khi major event → override interval
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

  // Effects mỗi tick (normalized per NPC trong zone)
  effects_per_tick: {
    food_stock_delta: number,    // units of food
    stress_delta: number,        // 0–100 scale
    trust_delta: number,         // applied to trust_in.government
    displacement_chance: number  // % NPC rời zone mỗi tick
  },

  source: 'player'|'institution'|'natural'|'cascade',
  narrative_open: string,

  // Cascade triggers — check mỗi tick
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
  to: string,               // institution id hoặc 'all'
  channel: 'public'|'private'|'signal'|'rumor',
  type: 'proposal'|'warning'|'commitment'|'info'|'appeal'|'ultimatum',
  content: string,
  public_cover: string,     // điều họ nói với dân (có thể khác content)
  credibility: number,      // track record của sender
  can_leak: boolean,
  tick: number
}
```

---

### WorldState
```javascript
{
  tick: number,             // 1 tick = 1 giờ sim
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
    gini: number,           // live gini của wealth distribution
    political_pressure: number // 0–100
  },

  narrative_log: NarrativeEntry[],

  // Constitutional drift tracking
  drift_score: number,      // so sánh với initial params
  crisis_pending: boolean
}
```

---

## Human Simulation Formulas

### 1. NPC Init từ Constitution

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

  const role_bonus = ROLE_WORLDVIEW_BONUS[role]  // xem bảng bên dưới

  const worldview = {
    collectivism:    clamp(0.5 + (value_bias.collectivism||0) + (role_bonus.collectivism||0) + gaussian(0, 0.15), 0, 1),
    authority_trust: clamp(constitution.base_trust + (value_bias.authority_trust||0) + (role_bonus.authority_trust||0) + gaussian(0, 0.20), 0, 1),
    risk_tolerance:  clamp(0.4 + (value_bias.risk_tolerance||0) + (role_bonus.risk_tolerance||0) + gaussian(0, 0.20), 0, 1),
    time_preference: clamp(constitution.safety_net * 0.5 + (value_bias.time_preference||0) + (role_bonus.time_preference||0) + gaussian(0, 0.15), 0, 1),
  }

  // Trust ban đầu từ constitution
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

### 2. Needs Decay (mỗi tick = 1 giờ sim)

```javascript
function decayNeeds(npc, state) {
  const food_available = state.macro.food > 15
  const violence_active = state.active_events.some(e => e.type === 'riot' || e.type === 'war')

  npc.hunger     += 0.5
  npc.exhaustion += 0.3
  npc.isolation  += 0.2
  npc.fear       += violence_active ? 2.0 : -0.3

  // Giảm theo activity
  if (npc.action_state === 'working' && food_available) npc.hunger -= 2.0
  if (npc.action_state === 'resting')                   npc.exhaustion -= 3.0
  if (npc.action_state === 'socializing') {
    npc.isolation -= 2.5
    if (npc.strong_ties.length < 3) npc.isolation += 1.0  // cô đơn dù đông người
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
  // Power function: nhỏ thì OK, lớn thì panic
  const h = Math.pow(npc.hunger     / 100, 1.6) * 0.35
  const e = Math.pow(npc.exhaustion / 100, 1.3) * 0.20
  const i = Math.pow(npc.isolation  / 100, 1.4) * 0.20
  const f = Math.pow(npc.fear       / 100, 1.8) * 0.25  // fear khuếch đại nhất

  // Identity stress: bị đối xử không xứng status
  const identity = computeIdentityStress(npc) * 0.10

  return clamp((h + e + i + f + identity) * 100, 0, 100)
}

function computeIdentityStress(npc) {
  // Cao khi: wealth thấp hơn expected cho role, hoặc bị disrespected
  const role_expected_wealth = ROLE_WEALTH_EXPECTATION[npc.role]
  return Math.max(0, (role_expected_wealth - npc.wealth) / role_expected_wealth)
}
```

---

### 4. Happiness (tương đối, không tuyệt đối)

```javascript
function computeHappiness(npc, state) {
  // Base từ inverse stress
  const stress_penalty = npc.stress * 0.55

  // So sánh với hàng xóm — relative deprivation
  const neighbor_avg = avgWealth(npc.weak_ties, state.npcs)
  const relative_status = clamp((npc.wealth - neighbor_avg) / 100, -1, 1) * 12

  // Bất bình đẳng — nhạy cảm theo worldview
  const inequality_pain = state.macro.gini * (npc.worldview.collectivism * 0.5 + 0.2) * 18

  // Memory effect (events gần đây)
  const memory_sum = npc.memory.reduce((s, m) => s + m.emotional_weight, 0)
  const memory_effect = clamp(memory_sum / 10, -15, 15)

  // Trust bonus — sống trong xã hội mình tin tưởng
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
  // Dưới threshold: routine bình thường
  if (npc.stress < npc.stress_threshold) {
    return normalRoutine(npc, state)  // working/resting/socializing theo giờ
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

  // Đói gây bất mãn
  if (npc.hunger > 60) delta += (npc.hunger - 60) * 0.08

  // Relative deprivation — thấy người khác có nhiều hơn
  const neighbor_avg = avgWealth(npc.weak_ties, state.npcs)
  if (npc.wealth < neighbor_avg) delta += (neighbor_avg - npc.wealth) / 200

  // Trust broken — spike lớn
  const recent_betrayal = npc.memory.find(m => m.type === 'trust_broken' && state.tick - m.tick < 720)
  if (recent_betrayal) delta += Math.abs(recent_betrayal.emotional_weight) * 0.05

  // Giảm khi được giúp
  const recent_help = npc.memory.find(m => m.type === 'helped' && state.tick - m.tick < 240)
  if (recent_help) delta -= 4

  // Social support giảm grievance
  delta -= (npc.strong_ties.length / 15) * 1.5

  // Decay chậm khi điều kiện cải thiện
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

### 8. Perception (cùng event, nghe khác nhau)

```javascript
function perceiveEvent(npc, event, sender_institution_id) {
  const trust = npc.trust_in[sender_institution_id]
  const sender_trust = (trust.competence + trust.intention) / 2

  // Stress khuếch đại tiêu cực
  const stress_amp = 1 + (npc.stress / 100) * 0.55

  // Trust factor: không tin → khuếch đại; tin → giảm nhẹ
  const trust_factor = sender_trust < 0.35 ? 1.45
                     : sender_trust > 0.70 ? 0.80
                     : 1.0

  // Worldview alignment: tin những gì khớp beliefs
  const alignment = eventAlignsWorldview(npc, event)
  const alignment_factor = alignment ? 1.25 : 0.65

  return clamp(event.intensity * stress_amp * trust_factor * alignment_factor, 0, 1)
}
```

---

### 9. Info Distortion qua Network

```javascript
function distortMessage(message, sender_npc) {
  const emotional_lean = (sender_npc.grievance - 50) / 100  // -0.5 đến +0.5
  const noise = (Math.random() - 0.5) * 0.15

  return {
    severity: clamp(message.severity * 0.85 + emotional_lean * 0.3 + noise, 0, 1),
    // content decay: giữ lại ~85% nội dung, cảm xúc sender thêm vào
    hops:     message.hops + 1
    // Sau 4+ hops: content gốc ~45%, emotion ~55%
  }
}

// Tốc độ lan: tin tiêu cực × 2 so với tin tích cực
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
    corruption:      { competence: -0.05, intention: -0.20 },  // intention gần như permanent
    helped_me:       { competence: +0.02, intention: +0.04 },
    harmed_me:       { competence: -0.08, intention: -0.12 },
    silent_in_crisis:{ competence: -0.04, intention: -0.06 }
  }

  const d = deltas[event_type] || { competence: 0, intention: 0 }
  t.competence = clamp(t.competence + d.competence * magnitude, 0, 1)
  t.intention  = clamp(t.intention  + d.intention  * magnitude, 0, 1)

  // Nếu intention đã bị phá xuống 0: recovery cap tại 0.35
  // "Một lần mất niềm tin vào lương tâm, không bao giờ hoàn toàn lấy lại"
  if (t.intention < 0.1 && d.intention > 0) {
    t.intention = Math.min(t.intention + d.intention * magnitude, 0.35)
  }
}
```

---

### 11. Worldview Drift (Radicalization)

```javascript
function updateWorldview(npc, state) {
  // Tích lũy dissonance
  let d_delta = 0
  if (npc.stress > npc.stress_threshold)
    d_delta += (npc.stress - npc.stress_threshold) * 0.08
  if (npc.memory.some(m => m.type === 'trust_broken' && state.tick - m.tick < 168))
    d_delta += 10
  if (npc.memory.some(m => m.type === 'windfall' && state.tick - m.tick < 72))
    d_delta -= 4
  d_delta -= (npc.strong_ties.length / 15) * 2  // social support là anchor

  npc.dissonance_acc = clamp(npc.dissonance_acc + d_delta, 0, 100)
  npc.susceptible    = npc.dissonance_acc > 60

  if (!npc.susceptible) return

  // Khi susceptible: drift về worldview của strong ties có influence cao nhất
  const influencers = npc.strong_ties
    .map(id => state.npcs[id])
    .sort((a, b) => b.influence_score - a.influence_score)
    .slice(0, 3)

  for (const dim of ['collectivism', 'authority_trust', 'risk_tolerance', 'time_preference']) {
    const avg_neighbor = influencers.reduce((s, n) => s + n.worldview[dim], 0) / influencers.length
    const pull = (avg_neighbor - npc.worldview[dim]) * npc.adaptability * 0.005
    npc.worldview[dim] = clamp(npc.worldview[dim] + pull, 0, 1)
  }

  // Không có ai tiếp cận → drift về extreme của cluster (mặc định)
  if (influencers.every(n => n.dissonance_acc < 30)) {
    // cluster ổn định → pull về center
  } else {
    // cluster cũng bất ổn → mutual radicalization
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

  // Perceived fairness: được nhận theo đóng góp không?
  const expected = ROLE_WEALTH_EXPECTATION[npc.role]
  const fairness = clamp(npc.wealth / expected, 0, 1.5)
  const fairness_bonus = (fairness - 1.0) * 0.2  // ±20%

  const stress_penalty = npc.stress / 200  // stress=100 → -50%

  return Math.max(0, npc.base_skill * motivation * (1 + fairness_bonus) * (1 - stress_penalty))
}
```

---

### 13. Macro Stats (emerge từ individuals)

```javascript
function computeMacroStats(state) {
  const npcs = state.npcs

  // Food: % nhu cầu được đáp ứng
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

  // Trust (avg government intention — phản ánh legitimacy)
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
  // Crisis khi drift > 0.35 trong 30+ ngày liên tiếp
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
    // STRONG TIES: cùng zone + cùng/gần role → gia đình, đồng nghiệp thân
    const same_zone = npcs.filter(n => n.id !== npc.id && n.zone === npc.zone)
    const same_role = same_zone.filter(n => n.role === npc.role)
    const diff_role = same_zone.filter(n => n.role !== npc.role)

    // Ưu tiên cùng role, lấp đầy bằng khác role
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
        // weak ties không nhất thiết bidirectional
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
    authInUrl: true  // key trong URL, không phải header
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

// State của God Agent (persist trong session)
const godState = {
  conversation_history: [],   // full history để agent nhớ context
  constitution: null,         // sau khi setup xong
  world_setup_done: false
}

async function setupWorld(aiConfig, onMessage) {
  // Cuộc trò chuyện đầu tiên → extract constitution
  // onMessage(text) stream từng phần ra UI
  // Trả về Constitution object khi user confirm
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

  // Parse JSON từ response
  const parsed = JSON.parse(extractJSON(response))
  return parsed  // GodResponse object
}

function buildWorldContext(state) {
  // Compress: chỉ gửi những gì agent cần
  return JSON.stringify({
    day: state.day, year: state.year,
    macro: state.macro,
    active_events: state.active_events.map(e => ({ type: e.type, intensity: e.intensity, zone: e.zones })),
    institutions: state.institutions.map(i => ({
      id: i.id, legitimacy: i.legitimacy, resources: i.resources,
      last_decision: i.decisions.at(-1)?.action
    })),
    stress_distribution: computeStressDistribution(state.npcs),  // histogram
    top_grievances: getTopGrievanceGroups(state.npcs)             // top 3 nhóm bất mãn
  })
}
```

### Rate Limiting
```javascript
const AI_SCHEDULE = {
  god_agent:           'on_demand',          // mỗi player message
  institution_decide:  'every_720_ticks',    // 30 ngày sim, hoặc khi force_decide=true
  narrative:           'on_significant',     // stress spike >15, cascade, player event
  npc_monologue:       'on_click'            // khi player click NPC
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

// Token estimate per sim-hour (real):
// God agent:        ~1500 tokens × ~3 calls = 4,500
// Institutions:     ~1200 tokens × ~2 calls = 2,400
// Narrative:        ~400 tokens  × ~5 calls = 2,000
// Total: ~9k tokens/hour → Gemini free: 1M tokens/day → OK
```

---

## Web Worker Architecture

```javascript
// ── Main → Worker ─────────────────────────────────────
worker.postMessage({ type: 'INIT',             constitution })
worker.postMessage({ type: 'INJECT_EVENT',     event })
worker.postMessage({ type: 'SET_SPEED',        speed })  // 1|3|10|max
worker.postMessage({ type: 'INST_DECISION',    decision, institution_id })
// ↑ main thread gọi LLM xong, gửi kết quả về worker

// ── Worker → Main ─────────────────────────────────────
// Mỗi tick: chỉ gửi diff
self.postMessage({
  type: 'TICK',
  day, year,
  macro,
  npc_diffs: [{ id, stress, action_state, x, y, grievance }],  // chỉ NPC thay đổi
  new_cascade_events: []
})

// Khi significant event:
self.postMessage({
  type: 'SIGNIFICANT_EVENT',
  event,
  institutions_to_decide: ['government', 'market']  // ai cần react
})
// → Main thread nhận → gọi LLM cho từng institution → gửi INST_DECISION về worker

// Khi constitutional crisis:
self.postMessage({ type: 'CONSTITUTIONAL_CRISIS', drift_score, institution_demands })
```

---

## Render — PixiJS Map

```javascript
// 3 zoom levels
// zoom < 0.4:  heatmap only — RenderTexture, update mỗi 10 ticks
// zoom 0.4-0.7: cluster mode — 1 sprite per zone-group
// zoom > 0.7:  individual NPCs trong viewport only

// Heatmap color mapping (avg stress per zone):
// stress 0–25:  #2a5820 (xanh — calm)
// stress 25–45: #8a7a30 (vàng — stress)
// stress 45–65: #8a3020 (đỏ — unrest)
// stress 65–85: #502080 (tím — radicalize)
// stress 85+:   #101010 (hitam — collapse)

// Event epicenter: ripple animation khi inject
// Flow arrows: hướng di chuyển của NPC trong zone
```

---

## Build Order

### Phase 1 — Nói chuyện được với thế giới
- [x] `index.html` layout (topbar + map placeholder + feed + chat)
- [x] `css/main.css` dark theme
- [x] `ai/provider.js` — callAI cho 3 providers
- [x] `ai/god-agent.js` — setupWorld + handlePlayerChat
- [x] `sim/constitution.js` — schema + presets + validation
- [x] Chat UI: nhập key, onboarding conversation, world init
- [x] **Milestone**: nhập key Gemini, chat để tạo constitution, sim khởi tạo

### Phase 2 — Simulation sống
- [x] `sim/npc.js` — createNPC, full formulas (1–13)
- [x] `sim/network.js` — buildNetwork
- [x] `sim/events.js` — event queue + effects
- [x] `sim/engine.js` — tick, initWorld, injectEvent, computeMacroStats
- [x] `workers/sim-worker.js` — tick loop + messaging
- [x] `render/map.js` — PixiJS heatmap cơ bản
- [x] **Milestone**: sim chạy 1k NPC, heatmap hiện stress, inject event từ chat

### Phase 3 — Institutions + Narrative
- [ ] `sim/institutions.js` — rule-based behavior
- [ ] `ai/institution-agent.js` — LLM decisions
- [ ] `ai/narrative-agent.js` — event log writing
- [ ] `render/feed.js` — narrative feed UI
- [ ] Inter-institution communication
- [ ] **Milestone**: institution phản ứng với event, narrative feed sống

### Phase 4 — Scale + Polish
- [ ] Scale lên 10k NPC (Worker optimization)
- [ ] PixiJS zoom levels (heatmap → clusters → individuals)
- [ ] NPC spotlight + LLM monologue
- [ ] Constitutional crisis screen
- [ ] **Milestone**: 10k NPC smooth, constitutional crisis trigger
