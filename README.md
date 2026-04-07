# Society Sim

A living world. You talk to it — and it responds according to its own logic.

---

## Core Idea

You are not the king. Not the manager.  
You are **The Narrator** — you set the initial rules, then drop events in and watch what happens.

Type *"create a major storm"* — an AI agent translates your intent into a structured event, injects it into the simulation, and a chain reaction begins: merchants stockpile, the government holds an emergency meeting, rumors spread, citizens start meeting in secret. Nobody asks you. They react according to who they are.

**No win. No lose.**  
Only the question: does the society you designed adapt or collapse?

---

## People Are the Foundation

Each NPC is not just a dot on a map. They have:

- **Needs** — hunger, exhaustion, loneliness, fear
- **Worldview** — collectivist or individualist, trusting or distrusting of authority
- **Memory** — a circular buffer of 10 recent experiences (betrayals, help, crises, windfalls)
- **Network** — 5–15 close contacts, 50–150 acquaintances, 10–40 ideological info-ties

They don't take orders. They react to accumulated pressure, filtered through their own lens, propagated through their network. The same event — each person hears a different version.

---

## Architecture

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
| **Provider Abstraction** | Unified adapter for Gemini, Anthropic (Claude), OpenAI, Ollama (local) | Via `callAI()` |

500 NPCs run **rule-based** — fast, no token cost. AI is only used where judgment is needed.

---

## Gameplay

### Step 1 — Choose AI Provider
Enter API key (optional — "No API" mode still runs the sim, just disables chat).  
Supports: Gemini Flash (default, free tier), Claude, GPT-4o Mini, Ollama.

### Step 2 — Design Your Society
God Agent asks: *"What society do you want to build?"*  
Describe in natural language, or pick a preset:

| Preset | Character |
|--------|-----------|
| Nordic | High trust, strong safety net |
| Capitalist | Free market, low state power |
| Socialist | Collectivist, redistributive |
| Feudal | High gini, hierarchical |
| Theocracy | Authority-heavy, low individual rights |
| Technocracy | Scholar-led, low democracy |
| Warlord | Fragmented, high fear |
| Commune | Egalitarian, decentralized |
| Marxist | State ownership, planned economy |

This becomes the **Constitution** — the DNA of the society.  
It determines citizen worldviews, institutional power, gini, safety net, value priorities.

### Step 3 — Observe
The sim runs itself. 1 real second = 1 sim-hour at default speed (1×/3×/10× available).  
Institutions make decisions. Citizens react. Feed updates continuously.

### Step 4 — Talk to the World
Type anything into the chat:
```
"create a major storm in the north"
"leak corruption info about the council"
"why are the people destabilizing?"
"what would happen if I caused a famine right now?"
```
God Agent interprets, warns of consequences, asks for confirmation, then injects.  
Major events trigger **predicted consequence scheduling** — future interventions queued automatically.

---

## Simulation Mechanics

### NPC Behavior
- Each tick (1 sim-hour): needs decay, stress recalculated, action state decided
- Actions: working, resting, socializing, organizing, fleeing, complying, confronting
- **Cascade**: `dissonance_acc` + `grievance` → susceptible NPCs join collective action, spreading through info-network (ideological ties, not geography)

### Social Network (3 layers)
- **Strong ties** (5–15): same zone + role + age proximity
- **Weak ties** (50–150): same/adjacent zone
- **Info ties** (10–40): worldview similarity — forms ideological echo chambers

### Institutions (5 agents)
Government, Market, Opposition, Community, Guard — each has resources, legitimacy, power, worldview.  
They send messages to each other, form deals, issue policies.  
With AI enabled: LLM decides policy. Without AI: deterministic fallbacks.

### Events (19 types)
`storm`, `drought`, `flood`, `epidemic`, `resource_boom`, `scandal_leak`, `charismatic_npc`, `martyr`, `tech_shift`, `trade_offer`, `refugee_wave`, `ideology_import`, `external_threat`, `blockade`, `wildfire`, `earthquake`, `harsh_winter`, `tsunami`

Events tick down duration, apply per-tick effects, can cascade into follow-up events.  
Epidemics spread to adjacent zones. Ideology imports shift worldviews over time.

### Trust & Memory
- Each NPC tracks `trust_in[institution]` — 2D: competence × intention
- Memories (10 entries): `trust_broken`, `helped`, `harmed`, `crisis`, `windfall`, `loss`, `illness`, `crime`, `accident`
- Memory → trust decay or boost → collective action threshold

---

## Stack

| Concern | Choice |
|---------|--------|
| Render | PixiJS (WebGL) — zone heatmap + 500 NPC dots |
| UI | Vanilla HTML/CSS overlay |
| AI (default) | Gemini Flash 2.5 (free tier) |
| AI (alternatives) | Claude, GPT-4o Mini, Ollama |
| Simulation | Pure TypeScript — no framework |
| Backend | None — runs entirely in the browser |
| i18n | English / Vietnamese |

---

## File Map

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
