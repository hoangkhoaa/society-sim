# Society Sim

<div align="center">

[![Live Demo](https://img.shields.io/badge/▶%20Play%20Live-GitHub%20Pages-4A90E2?style=for-the-badge&logo=github)](https://hoangkhoaa.github.io/society-sim/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![PixiJS](https://img.shields.io/badge/PixiJS-8.0-E91E63?style=for-the-badge)](https://pixijs.com/)
[![Vite](https://img.shields.io/badge/Vite-5.2-646CFF?style=for-the-badge&logo=vite)](https://vitejs.dev/)

**A living world. You talk to it — and it responds according to its own logic.**

*Design a society. Drop events into it. Watch 500 citizens adapt — or collapse.*

[![Game Screenshot](https://github.com/user-attachments/assets/eed5272b-5fcc-46d0-9b5d-d23c58eaa17c)](https://hoangkhoaa.github.io/society-sim/)

</div>

---

## 🎮 Play Now

**No installation needed.** Open your browser and go:

> **[https://hoangkhoaa.github.io/society-sim/](https://hoangkhoaa.github.io/society-sim/)**

- Works **without an API key** — run the full simulation in rule-based mode
- Add a **Gemini / Claude / GPT-4o / Ollama** key to unlock natural-language events and AI-driven institutions

---

## 🧠 Core Idea

You are not the king. Not the manager.  
You are **The Narrator** — you set the initial rules, then drop events in and watch what happens.

Type *"create a major storm"* — an AI agent translates your intent into a structured event, injects it into the simulation, and a chain reaction begins: merchants stockpile, the government holds an emergency meeting, rumors spread, citizens start meeting in secret. Nobody asks you. They react according to who they are.

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
      <sub><b>Step 3 — Watch It Unfold</b><br/>500 NPCs across 8 zones — color-coded by role, connected by social networks, reacting in real time</sub>
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

They don't take orders. They react to accumulated pressure, filtered through their own lens, propagated through their network. The same event — each person hears a different version.

---

## 🗺️ The World

Eight distinct zones, each with its own character:

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

This becomes the **Constitution** — the DNA of the society, determining citizen worldviews, institutional power, gini, safety net, and value priorities.

### Step 3 — Observe
The sim runs itself. **1 real second = 1 sim-hour** at default speed (1×/3×/10× available).  
Institutions make decisions. Citizens react. Feed updates continuously.

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

## ⚙️ Architecture

```
Player Chat ("create a major storm")
  → God Agent (LLM) — interprets → structured event + predicted consequences
  → Simulation Engine — rule-based tick loop for 500 NPCs
  → Institution Agents (LLM) — 5 institutions decide policy every 15 sim-days
  → Map + Feed updates in real-time
```

### 3 AI Layers

| Layer | Role | When called |
|-------|------|-------------|
| **God Agent** | Translates chat → event or NPC intervention, answers world questions, predicts consequences | Every player message |
| **Institution Agents (×5)** | Government, Market, Opposition, Community, Guard — make policy decisions, send inter-institution messages | Every 15 sim-days |
| **Provider Abstraction** | Unified adapter for Gemini, Anthropic (Claude), OpenAI, Ollama (local/remote) | Via `callAI()` |

> 500 NPCs run **rule-based** — fast, deterministic, zero token cost. AI is only invoked where judgment is needed.

---

## 🔬 Simulation Mechanics

### NPC Behavior
- Each tick (1 sim-hour): needs decay, stress recalculated, action state decided
- Actions: `working` · `resting` · `socializing` · `organizing` · `fleeing` · `complying` · `confronting`
- **Cascade**: `dissonance_acc` + `grievance` → susceptible NPCs join collective action, spreading through the info-network (ideological ties, not geography)

### Social Network (3 layers)
| Layer | Size | Basis |
|-------|------|-------|
| **Strong ties** | 5–15 | Same zone + role + age proximity |
| **Weak ties** | 50–150 | Same/adjacent zone |
| **Info ties** | 10–40 | Worldview similarity — ideological echo chambers |

### Institutions (5 agents)
Government, Market, Opposition, Community, Guard — each has resources, legitimacy, power, worldview.  
They send messages to each other, form deals, issue policies.  
With AI enabled: LLM decides policy. Without AI: deterministic rule-based fallbacks.

### Events (19 types)
`storm` · `drought` · `flood` · `epidemic` · `resource_boom` · `scandal_leak` · `charismatic_npc` · `martyr` · `tech_shift` · `trade_offer` · `refugee_wave` · `ideology_import` · `external_threat` · `blockade` · `wildfire` · `earthquake` · `harsh_winter` · `tsunami`

Events tick down duration, apply per-tick effects, and can cascade into follow-up events.  
Epidemics spread to adjacent zones. Ideology imports shift worldviews over time.

### Trust & Memory
- Each NPC tracks `trust_in[institution]` — 2D: **competence × intention**
- Memory entries: `trust_broken` · `helped` · `harmed` · `crisis` · `windfall` · `loss` · `illness` · `crime` · `accident`
- Memory → trust decay or boost → collective action threshold

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
│   ├── npc.ts           — NPC lifecycle, needs, actions, events
│   ├── network.ts       — Social network builder (strong/weak/info ties)
│   ├── government.ts    — Institution AI, policy decisions, alert detection
│   └── constitution.ts  — Institution init, math utilities
├── ui/
│   ├── map.ts           — PixiJS canvas renderer, NPC visualization, zone grid
│   ├── feed.ts          — Event log & chronicle
│   ├── spotlight.ts     — NPC detail modal
│   └── modal.ts         — Confirm/info dialogs
├── types.ts             — Complete type system
├── i18n.ts              — English / Vietnamese strings
└── main.ts              — Entry point, UI controller, sim loop
```

---

## 🚀 Local Development

```bash
git clone https://github.com/hoangkhoaa/society-sim.git
cd society-sim
npm install
npm run dev        # → http://localhost:5173/society-sim/
npm run build      # Build for production → dist/
```

---

<div align="center">

Made with ❤️ · [Play Live →](https://hoangkhoaa.github.io/society-sim/)

</div>
