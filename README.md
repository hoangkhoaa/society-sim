# Society Sim

<div align="center">

[![Live Demo](https://img.shields.io/badge/▶%20Play%20Live-GitHub%20Pages-4A90E2?style=for-the-badge&logo=github)](https://hoangkhoaa.github.io/society-sim/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![PixiJS](https://img.shields.io/badge/PixiJS-8.0-E91E63?style=for-the-badge)](https://pixijs.com/)
[![Vite](https://img.shields.io/badge/Vite-5.2-646CFF?style=for-the-badge&logo=vite)](https://vitejs.dev/)

**A living world. You talk to it — and it responds according to its own logic.**

*Design a society. Drop events into it. Watch 500 citizens adapt — or collapse.*

[![Game Screenshot](https://github.com/user-attachments/assets/eed5272b-5fcc-46d0-9b5d-d23c58eaa17c)](https://hoangkhoaa.github.io/society-sim/)

> **Latest snapshot:** commit `084d28f` — government policy reactions, political factions, technology tree, free press, labor strikes, rumor system, and story cards.

</div>

---

## 🎮 Play Now

**No installation needed.** Open your browser and go:

> **[https://hoangkhoaa.github.io/society-sim/](https://hoangkhoaa.github.io/society-sim/)**

- Works **without an API key** — run the full simulation in rule-based mode
- Add a **Gemini / Claude / GPT-4o / Ollama** key to unlock natural-language events, AI-driven institutions, and richer press headlines

---

## 🧠 Core Idea

You are not the king. Not the manager.  
You are **The Narrator** — you set the initial rules, then drop events in and watch what happens.

Type *"create a major storm"* — an AI agent translates your intent into a structured event, injects it into the simulation, and a chain reaction begins: merchants stockpile, the government holds an emergency meeting, the free press runs headlines, rumors spread through ideological networks, and citizens start meeting in secret. Nobody asks you. They react according to who they are.

**No win. No lose.**  
Only the question: does the society you designed adapt or collapse?

---

## 📸 Screenshots

<table>
  <tr>
    <td align="center" width="50%">
      <img src="https://github.com/user-attachments/assets/52a670ad-34e0-4bb8-b5da-1f5a99393295" alt="Onboarding — choose your AI provider" width="100%"/>
      <sub><b>Step 1 — Choose AI Provider</b><br/>Connect Gemini, Claude, GPT-4o, Ollama, or play free without any key</sub>
    </td>
    <td align="center" width="50%">
      <img src="https://github.com/user-attachments/assets/6b15cb8b-4677-4258-b45f-fb96cde8f1aa" alt="Society Setup — pick a preset" width="100%"/>
      <sub><b>Step 2 — Design Your Society</b><br/>Pick a preset or describe your society in natural language</sub>
    </td>
  </tr>
  <tr>
    <td align="center" colspan="2">
      <img src="https://github.com/user-attachments/assets/eed5272b-5fcc-46d0-9b5d-d23c58eaa17c" alt="Main game — live simulation with 500 NPCs" width="100%"/>
      <sub><b>Step 3 — Watch It Unfold</b><br/>500 NPCs across 9 zones — color-coded by role, connected by social networks, reacting in real time</sub>
    </td>
  </tr>
</table>

---

## 👥 People Are the Foundation

Each NPC is not just a dot on a map. They have:

| Attribute | Detail |
|-----------|--------|
| **Needs** | Hunger, exhaustion, loneliness, fear — each decays every tick |
| **Worldview** | Collectivist ↔ Individualist · Trusting ↔ Distrusting of authority |
| **Memory** | Circular buffer of 10 recent experiences (betrayals, help, crises, windfalls) |
| **Network** | 5–15 close contacts · 50–150 acquaintances · 10–40 ideological info-ties |
| **Work rhythm** | Individual `bio_clock_offset` (±hours) + one of 6 motivation types: `survival` · `coerced` · `mandatory` · `happiness` · `achievement` · `duty` |
| **Class solidarity** | 0–100 score that spreads among same-role neighbors; fuels collective action and strikes |
| **Romance & family** | Courtship scores, marriage, heartbreak cooldown (30 days), children, mentorship |
| **Burnout** | 480 consecutive high-stress + high-exhaustion ticks (20 sim-days) triggers collapse |

They don't take orders. They react to accumulated pressure, filtered through their own lens, propagated through their network. The same event — each person hears a different version.

---

## 🗺️ The World

Nine distinct zones, each with its own character:

| Zone | Role |
|------|------|
| 🌾 Northern Fields | Agricultural heartland — farmers, food production |
| 🏫 Academy Hill | Knowledge hub — scholars, research, ideology |
| 🏘 West Village | Residential — craftsmen, families, community bonds |
| 🏛 Town Square | Political center — leaders, institutions, protests |
| 🏪 Market Quarter | Commerce — merchants, trade, wealth concentration |
| ⚔️ The Garrison | Security — guards, enforcers, military presence |
| 🌿 Southern Pastures | Rural outskirts — farmers, low resources |
| 🔨 Artisan Row | Production — craftsmen, skilled labor |
| 🏚 East Settlement | Peripheral — mixed population, vulnerable |

---

## 🎯 How to Play

### Step 1 — Choose AI Provider
<img src="https://github.com/user-attachments/assets/52a670ad-34e0-4bb8-b5da-1f5a99393295" alt="Onboarding screen" width="480"/>

An animated network visualization plays in the background while you configure.  
Enter an API key (optional — "No API" mode still runs the full sim, just disables chat).  
Supports: **Gemini Flash** (default, free tier), **Claude**, **GPT-4o Mini**, **Ollama** (local/remote).

### Step 2 — Design Your Society
<img src="https://github.com/user-attachments/assets/6b15cb8b-4677-4258-b45f-fb96cde8f1aa" alt="Society setup screen" width="480"/>

With AI: describe your society in natural language.  
Without AI: pick from 9 presets:

| Preset | Character |
|--------|-----------|
| 🏔 Nordic | High trust, strong safety net, low gini |
| 💹 Free Market | Low state power, high inequality, entrepreneurial |
| ⚙ Planned Economy | Collectivist, redistributive, state-directed |
| ⚔️ Feudalism | High gini, rigid hierarchy, low mobility |
| ⛪ Theocracy | Authority-heavy, ideological conformity |
| 🧠 Technocracy | Scholar-led, meritocratic, low democracy |
| 🗡 Warlord State | Fragmented, high fear, low institutional trust |
| 🌿 Commune | Egalitarian, decentralized, high solidarity |
| ☭ Marxist | State ownership, planned economy, collectivist |

This becomes the **Constitution** — the DNA of the society, determining citizen worldviews, institutional power, gini, safety net, work schedule, and value priorities.

### Step 3 — Observe
The sim runs itself. **1 real second = 1 sim-hour** at default speed (1×/3×/10× available).  
Institutions make decisions. Citizens react. The feed and chronicle update continuously.  
**Story cards** slide up from the map bottom when a major or critical narrative event fires — rags-to-riches, a fall from grace, a heroic act, a conspiracy — drawn from real simulation data.

### Step 4 — Talk to the World *(requires API key)*
```
"create a major storm in the north"
"leak corruption info about the council"
"why are the people destabilizing?"
"what would happen if I caused a famine right now?"
```
The God Agent interprets, warns of consequences, asks for confirmation, then injects the event.  
Major events trigger **predicted consequence scheduling** — future interventions are queued automatically.

---

## 🖥️ UI Overview

The main screen is divided into four areas:

```
┌─────────────────── Topbar ────────────────────────────┐
│ Clock · Regime · Stability · Food · Resources ·       │
│ Energy · Trust · Gini  ·  ⏸ Speed 👥 🗣 🕸 🌙 📜 🏛  │
├────────────────────────────────────┬──────────────────┤
│                                    │  Event Log       │
│          Map (PixiJS)              │  ──────────────  │
│                                    │  Chronicle       │
│  [Demographics]  [Rumors]          │  (with Rumors    │
│                                    │   sub-section)   │
├────────────────────────────────────┴──────────────────┤
│  Chat bar — "Talk to the world..."                    │
└───────────────────────────────────────────────────────┘
```

### Topbar
| Element | Description |
|---------|-------------|
| **Clock / Regime** | Sim date + detected regime type |
| **Macro stats** | Stability · Food · Resources · Energy · Trust · Gini — color-coded with delta badges |
| **⏸ / Speed** | Pause or cycle 1×/3×/10× |
| **👥 Demographics** | Toggle population + labor panel |
| **🗣 Rumors** | Toggle active-rumors overlay |
| **🕸 Legend** | Toggle network layer legend on map |
| **🌙 Theme** | Toggle light/dark mode |
| **📜 Constitution** | View current constitutional parameters |
| **🏛 Gov cycle** | Manually trigger the government AI cycle |
| **AI usage** | Live request + token counter |

### Map overlays
- **Demographics panel** (bottom-left) — total population, births, deaths, immigration, age distribution, and a **labor section** showing per-role solidarity/grievance bars with danger indicators
- **Rumors panel** (bottom-left, next to demographics) — scrolling list of active rumors with reach % and days remaining
- **Story cards** — cinematic cards that slide up from the bottom of the map for 8 seconds on major/critical narrative events
- **Crisis banner** — red overlay across the top when 3+ macro stats are critical
- **NPC Spotlight** — click any NPC dot to open a detail panel (needs, worldview, memory, network, daily thought)
- **Institution panel** — click any institution zone to inspect its resources, legitimacy, decisions, and inbox

### Right sidebar
- **Event Log** — filterable by severity (All / Important / Critical)
- **Chronicle** — long-form narrative history, resizable; filterable (All / Important / Critical); includes a **Rumors** sub-section

---

## ⚙️ Architecture

```
Player Chat ("create a major storm")
  → God Agent (LLM) — interprets → structured event + predicted consequences
  → Simulation Engine — rule-based tick loop for 500 NPCs
  → Institution Agents (LLM) — 5 institutions decide policy every 15 sim-days
  → Free Press (LLM / template) — generates headlines every 5 sim-days
  → Narrative Engine — fires 0–2 story events per sim-day from real data
  → Map + Feed + Chronicle + Story Cards update in real time
```

### 3 AI Layers

| Layer | Role | When called |
|-------|------|-------------|
| **God Agent** | Translates chat → event or NPC intervention, answers world questions, predicts consequences | Every player message |
| **Institution Agents (×5)** | Government, Market, Opposition, Community, Guard — make policy decisions, read the press, send inter-institution messages | Every 15 sim-days |
| **Free Press** | Generates newspaper headlines from societal signals; passes context to Government before it decides | Every 5 sim-days |
| **Provider Abstraction** | Unified adapter for Gemini, Anthropic (Claude), OpenAI, Ollama (local/remote) | Via `callAI()` |

> 500 NPCs run **rule-based** — fast, deterministic, zero token cost. AI is only invoked where judgment is needed.

---

## 🔬 Simulation Mechanics

### NPC Behavior
- Each tick (1 sim-hour): needs decay, stress recalculated, action state decided
- Actions: `working` · `resting` · `socializing` · `organizing` · `fleeing` · `complying` · `confront`
- **Cascade**: `dissonance_acc` + `grievance` → susceptible NPCs join collective action, spreading through the info-network (ideological ties, not geography)
- **Policy reactions**: when a government policy lands, NPCs are classified as `loyalist` / `pragmatist` / `skeptic` / `dissident` based on their authority trust and government trust scores, and react accordingly — feed entries, worldview drift, attitude spread

### Social Network (3 layers)
| Layer | Size | Basis |
|-------|------|-------|
| **Strong ties** | 5–15 | Same zone + role + age proximity; used for illness spread, trade, mentorship |
| **Weak ties** | 50–150 | Same/adjacent zone; used for class solidarity spread |
| **Info ties** | 10–40 | Worldview similarity — ideological echo chambers; used for worldview drift and rumor spread |

Each NPC also has a `bridge_score` (0–1) measuring how many separate zone-clusters appear in their weak ties — high bridge NPCs carry information across communities.

### Institutions (5 agents)
Government, Market, Opposition, Community, Guard — each has resources, legitimacy, power, worldview.  
They send messages to each other on `public` / `private` / `signal` / `rumor` channels, form deals, issue policies.  
With AI enabled: LLM decides policy and reads the latest press headlines first.  
Without AI: deterministic rule-based fallbacks.

### Political Factions
NPCs with aligned worldviews in the same community groups self-organize into **political factions** (up to 6 active at a time). Each faction has a dominant value — `security` · `equality` · `freedom` · `growth` — and takes collective action every 10 sim-days: security factions rally and reduce fear, equality factions redistribute wealth, freedom factions resist authority, growth factions invest in productivity.

### Technology Tree
Scholars accumulate **research points** each sim-day. When the pool crosses a milestone, a discovery is unlocked and permanently changes the simulation:

| Milestone | Threshold | Effect |
|-----------|-----------|--------|
| 🌾 Advanced Agriculture | 500 pts | +15% food production |
| 💊 Folk Medicine | 1 500 pts | −50% sickness rate |
| 📦 Trade Networks | 3 000 pts | +5% merchant efficiency |
| 📰 Printing & Record-Keeping | 5 000 pts | +10 literacy; faster worldview spread |

### Free Press
Every 5 sim-days, a **press cycle** scans societal signals (food, stability, sickness rates, flee %, grievance, etc.) and generates newspaper headlines. In AI mode these are LLM-written; in template mode ~100 pre-written templates cover the full condition space. Headlines are logged in the Chronicle and passed as context to Institution Agents before their next decision.

### Labor Strikes
When a role's average `class_solidarity` × `grievance` exceeds the threshold, that occupational class goes on **strike**:
- Strikers stop working — output for that role drops to zero
- Strikes have a demand: `wages` · `conditions` · `rights`
- The government can end a strike early via policy
- The Demographics panel shows per-role solidarity (blue) and grievance (red) bars; a ⚠ danger badge appears when a strike is imminent

### Rumor System
Events and press cycles seed **rumors** that spread through NPC info-ties:
- Each rumor has a subject (institution or NPC) and an effect: `trust_down` · `trust_up` · `fear_up` · `grievance_up`
- Reach % and days-remaining are shown in the Rumors panel
- Long rumor text scrolls via a CSS marquee animation

### Narrative Engine
Every sim-day the narrative engine attempts to fire 0–2 vivid chronicle stories drawn from real simulation data — rags-to-riches, fall from grace, star-crossed lovers, factionalism, a scholar's discovery, labor unrest, epidemic heroes, and more. Stories above `minor` severity trigger a **story card** on the map and an entry in the Chronicle.

### Events (23 types)
`storm` · `drought` · `flood` · `tsunami` · `epidemic` · `resource_boom` · `harsh_winter` · `trade_offer` · `refugee_wave` · `ideology_import` · `external_threat` · `blockade` · `scandal_leak` · `charismatic_npc` · `martyr` · `tech_shift` · `wildfire` · `earthquake` · `nuclear_explosion` · `bombing` · `meteor_strike` · `volcanic_eruption`

Events tick down duration, apply per-tick effects, and can cascade into follow-up events.  
Epidemics spread to adjacent zones and can trigger Guard quarantine. Ideology imports shift worldviews over time.

### Trust & Memory
- Each NPC tracks `trust_in[institution]` — 2D: **competence × intention**
- Memory entries: `trust_broken` · `helped` · `harmed` · `crisis` · `windfall` · `loss` · `illness` · `crime` · `accident`
- Memory → trust decay or boost → collective action threshold

### Macro Stats (10 indicators)
| Stat | Description |
|------|-------------|
| **Stability** | Overall societal order (0–100) |
| **Food** | Food supply level (0–100) |
| **Resources** | Remaining natural resource pool (0–100) |
| **Energy** | Society's productive energy output (0–100) |
| **Trust** | Average government intention trust (0–100) |
| **Gini** | Wealth inequality coefficient (0–1) |
| **Labor Unrest** | avg class_solidarity × gini; triggers alert ≥ 65 |
| **Polarization** | Ideological split from worldview variance (0–100) |
| **Literacy** | Scholar-driven; boosts economy and info spread (0–100) |
| **Political Pressure** | Accumulated grievance + dissonance (0–100) |

---

## 🛠️ Tech Stack

| Concern | Choice |
|---------|--------|
| Renderer | PixiJS 8 (WebGL) — zone heatmap + 500 NPC dots |
| UI | Vanilla HTML/CSS overlay |
| AI (default) | Gemini Flash 2.5 (free tier) |
| AI (alternatives) | Claude, GPT-4o Mini, Ollama (local/cloud) |
| Simulation | Pure TypeScript — no framework |
| Backend | **None** — runs entirely in the browser |
| i18n | English / Vietnamese |

---

## 🗂️ File Map

```
src/
├── ai/
│   ├── god-agent.ts     — LLM orchestration (setup, chat, consequences, NPC thoughts)
│   └── provider.ts      — Unified AI adapter (Gemini / Anthropic / OpenAI / Ollama)
├── sim/
│   ├── engine.ts        — Tick loop, world init, macro stats, crisis detection
│   ├── npc.ts           — NPC lifecycle, needs, actions, work motivation, burnout
│   ├── network.ts       — Social network builder (strong/weak/info ties, bridge score)
│   ├── government.ts    — Institution AI, policy decisions, alert detection, policy reactions
│   ├── constitution.ts  — Institution init, math utilities
│   ├── factions.ts      — Political faction formation and collective action
│   ├── press.ts         — Free press headline generation (template + AI)
│   ├── tech.ts          — Technology tree: research accumulation and milestones
│   └── narratives.ts    — Rich narrative event engine + rumor spread
├── ui/
│   ├── map.ts           — PixiJS canvas renderer, NPC visualization, zone grid
│   ├── feed.ts          — Event log & chronicle
│   ├── spotlight.ts     — NPC detail panel + institution panel
│   ├── modal.ts         — Confirm/info dialogs
│   └── story-card.ts    — Cinematic story card overlay (slides up 8 s on major events)
├── local/
│   ├── government.ts    — Policy reaction templates keyed by stance × policy type
│   ├── press.ts         — Press snapshot types and AI/template prompts
│   └── narratives.ts    — Narrative text templates (NT.*) in English + Vietnamese
├── types.ts             — Complete type system
├── i18n.ts              — English / Vietnamese strings
└── main.ts              — Entry point, UI controller, sim loop, labor/rumor displays
```

---

## 🚀 Local Development

```bash
git clone https://github.com/hoangkhoaa/society-sim.git
cd society-sim
npm install
npm run dev        # → http://localhost:5173/society-sim/
npm run build      # Build for production → dist/
npx tsc --noEmit   # Type-check only
```

---

<div align="center">

Made with ❤️ · [Play Live →](https://hoangkhoaa.github.io/society-sim/)

</div>
