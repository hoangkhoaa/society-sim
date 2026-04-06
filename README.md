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
- **Memory** — remembers past betrayals, remembers when they were helped
- **Network** — 5–15 close contacts, 50–150 acquaintances

They don't take orders. They react to accumulated pressure, filtered through their own lens, propagated through their network. The same event — each person hears a different version.

---

## Architecture

```
Player Chat ("create a major storm")
  → God Agent (LLM) — interprets → structured event
  → Simulation Engine — rule-based cascade for 10,000 NPCs
  → Institution Agents (LLM) — 5 institutions react independently
  → Narrative Agent (LLM) — rewrites as a story
  → Map + Feed updates
```

### 3 AI Layers

| Layer | Role | When called |
|-------|------|-------------|
| God Agent | Translates chat → event, answers questions about the world | Every player message |
| Institution Agents (×5) | Government, Market, Opposition, Community, Guard | On major events / every N sim-days |
| Narrative Agent | Rewrites event log into rich narrative | When a significant event occurs |

10,000 NPCs run **rule-based** — fast, no token cost. AI is only used where judgment is needed.

---

## Gameplay

The player is **The Architect** — a single role throughout. No separate setup screen, no context switching.

### Step 1 — The First Conversation
Enter API key → God Agent asks: *"What society do you want to build?"*  
Describe in natural language. Agent proposes params, you confirm.  
This is the DNA of the society — determines the initial worldview of citizens, institutional power, safety net, gini.

### Step 2 — Observe
The sim runs itself. Institutions make decisions. Citizens react. Narrative feed updates.

### Step 3 — Talk to the World
Type anything into the chat:
```
"create a major storm in the north"
"leak corruption info about the council"
"why are the people destabilizing?"
"what would happen if I caused a storm right now?"
```
God Agent interprets, warns of consequences, asks for confirmation, then injects.

### Step 4 — Constitutional Crisis
When society has drifted far enough from its original design — institutions demand amendments.  
You decide: hold the line or reform. Both have a price.

---

## Files

```
society_sim.html          — original prototype (30 NPCs, 2D canvas, zero deps)
brainstorm_2026-04-06.md  — full design decisions and mechanics
ui_gameplay_design.md     — detailed UI and gameplay design
```

---

## Planned Stack

- **Render:** PixiJS (WebGL) — heatmap + 10k NPCs
- **UI:** Vanilla HTML/CSS overlay
- **AI:** Gemini Flash 2.5 (default, free tier) — open settings to switch provider
- **Simulation:** Pure JavaScript — no framework
- **Zero backend** — runs in the browser, API key provided by the user
