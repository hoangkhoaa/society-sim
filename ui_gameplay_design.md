# UI & Gameplay Design

## Design Philosophy

> As little UI as possible. Everything the player needs to know should **emerge from the narrative**, not from a statistics dashboard.

The player is **The Narrator** — they write the initial constitution, then talk to the world in natural language. No event menus. No complex buttons. Just chat — and consequences.

---

## Screen Layout

```
┌─────────────────────────────────────────────────────────────┐
│  TOPBAR — clock + 3-4 most critical macro indicators        │
├──────────────────────────────┬──────────────────────────────┤
│                              │                              │
│      MAP VIEW                │     NARRATIVE FEED           │
│      (canvas)                │     (live event log)         │
│                              │                              │
│   free zoom/pan              │   scroll up for history      │
│   click NPC → spotlight      │   click event → highlight    │
│   click building → info      │   on map                     │
│                              │                              │
├──────────────────────────────┴──────────────────────────────┤
│  BOTTOM BAR — event inject panel + time controls            │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. Topbar — Macro Indicators

Not all stats. Only the 4 most important, color-coded by threshold:

```
[Year 3 · Month 2 · Day 14]   Stability 61% ⚠   Food 43% ✕   Trust 34%   Gini 0.52
```

- Green: stable
- Yellow ⚠: needs attention
- Red ✕: dangerous, may trigger cascade

No bar charts, no secondary stats — numbers only. Click for details.

---

## 2. Map View

### Not a Traditional Tile Map

The map shows the **emotional density** of the population, not terrain:

```
Zones light up based on state:
  Green   — productive, happy area
  Yellow  — stress is rising
  Red     — unrest, potential flashpoint
  Purple  — radicalization spreading
  Gray    — abandoned, people have left
```

### NPC Rendering at 10,000 People

Don't render every dot — render **flow and clusters**:

```
Zoom out: see density heatmap + flow arrows (where people are moving)
Zoom mid: see cluster groups (meeting groups, working groups, fleeing groups)
Zoom in:  see individual NPC dots, click to spotlight
```

### Click NPC — Spotlight Panel

Not a small popup. A side panel opens:

```
┌─────────────────────────┐
│ Nguyen Van An · Farmer  │
│ ─────────────────────── │
│ Emotion:  Angry         │
│ Stress:   ████████░░ 78%│
│ Trust:    ███░░░░░░░ 28%│
│ ─────────────────────── │
│ WORLDVIEW               │
│ Collectivist    ██████░ │
│ Authority trust █░░░░░░ │
│ Risk tolerance  ████░░░ │
│ ─────────────────────── │
│ THINKING                │
│ "The government promised│
│  3 times then did       │
│  nothing. I won't       │
│  believe them again."   │
│ ─────────────────────── │
│ RECENT                  │
│ · Joined secret meeting │
│   on day 26             │
│ · Heard rumor from Binh │
│ · Refused work on day 28│
└─────────────────────────┘
```

"Thinking" — LLM generates 1-2 sentences of internal monologue, called on click.  
Not real-time, only when interacted with.

---

## 3. Narrative Feed

Right column — **heart of the UI**.

```
── Year 3, Month 2 ────────────────────

  [Day 14] 🌿 Drought begins in the south

  [Day 18] 📈 Merchants Guild raises food
             prices 20%
             → Government does not respond

  [Day 21] 💬 Rumor spreads quickly:
             "Merchants backed by the council"
             (source: unverified)

  [Day 26] 👥 Group of 12 farmers meet
             secretly in the south — first time

  [Day 31] 🏘 Community self-organizes
             food distribution — bypassing
             government

  [Day 35] ⚡ Opposition declares:
             "Who does this constitution protect?"
             → +8% support in 3 days

  [Day 40] ⚠ Guard Corps receives orders
  ┌─────────────────────────────────┐
  │  to disperse the informal market│  ← ongoing event
  │  → 30% of soldiers refuse       │
  └─────────────────────────────────┘
```

### Feed Features:
- Click event → highlight related people on map
- Icon categories: 🌿 nature · 📈 economic · 💬 rumor · 👥 social · ⚡ political · ⚠ critical
- Events written by LLM — not rigid templates
- Color-coded by severity
- Scroll up to see full history

---

## 4. Bottom Bar — Chat Input + Time Controls

No dropdown menus. The player talks to the world.

```
┌────────────────────────────────────────────────────────────┐
│  [⏸] [1× · 3× · 10×]    Year 3 · Month 2   [📜 Constitution]│
│  ────────────────────────────────────────────────────────  │
│  🌐  "hey create a big storm"                    [Send →]  │
└────────────────────────────────────────────────────────────┘
```

### Example Player Inputs:
```
"create a major storm in the north"
"leak council corruption"
"have a new leader rise among the people"
"why is the population destabilizing?"
"what if I cause a storm right now?"
"which group is closest to rioting?"
```

### Flow When Player Sends Message:
```
1. Feed shows: "[ Interpreting... ]"

2. God Agent responds — warns before injecting:
   "A severe storm will hit the northern agricultural zone.
    Food drops ~45% in 8 days. Food is currently at 43% —
    this may trigger collective action."
    [Confirm]  [Adjust]  [Cancel]

3. Player confirms → event injected

4. Map: northern region darkens, ripple from epicenter
   Feed: narrative agent writes consequences in real time

5. Institution agents gradually respond through feed:
   "[Day 15] Merchants Guild silent — stockpiling"
   "[Day 16] Government holds emergency meeting, no announcement"
   "[Day 18] Rumor spreads: storm is divine punishment for..."
```

### Constitution Button:
Opens a dedicated screen — view and (with sufficient consensus) propose amendments.

---

## 5. Onboarding — The First Conversation

No setup screen with sliders and radio buttons.  
Establishing the constitution **is the first conversation with the God Agent**.

The player is **The Architect** — a single role throughout the game, from designing to injecting events.

```
┌──────────────────────────────────────────────────────────┐
│  SOCIETY SIM                                             │
│                                                          │
│  Provider: [Gemini Flash 2.5 ▾]  Key: [____________]    │
│                                            [ Begin → ]   │
└──────────────────────────────────────────────────────────┘
```

After entering key → chat opens, God Agent speaks first:

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│  God Agent:                                              │
│  "What kind of society do you want to build?            │
│   Describe it — or choose a starting point:             │
│   [Nordic]  [Free Market]  [Planned Economy]  [Custom]" │
│                                                          │
│  Player:                                                 │
│  "Nordic-style but with scarcer resources               │
│   and a weaker state than usual"                        │
│                                                          │
│  God Agent:                                              │
│  "Understood. Here are the parameters I propose:        │
│   · Gini: 0.31 (moderate equality)                      │
│   · State power: 0.4 (weaker than standard Nordic)      │
│   · Safety net: medium                                   │
│   · Resource scarcity: high                              │
│   · Base trust: 0.58                                     │
│                                                          │
│   Would you like to adjust anything?"                    │
│                                                          │
│  Player: "Looks good, let's start"                       │
│                                                          │
│  → Sim initializes. Map and feed appear.                 │
└──────────────────────────────────────────────────────────┘
```

### Why Not Use Sliders/Forms:

- Player learns how the world works from the very first sentence
- God Agent has context for *why* the player chose that setup — useful later when explaining consequences
- Player can ask "how would Socialist differ from Nordic?" before deciding
- Single role throughout — no separate screens, no context switching

---

## 6. Constitutional Crisis Screen

Appears when the sim detects that society has drifted too far from the initial constitution.

```
┌──────────────────────────────────────────────────────────┐
│  ⚖ CONSTITUTIONAL CRISIS                                 │
│                                                          │
│  "After 5 years, society has changed. The current       │
│   constitution no longer reflects reality."             │
│                                                          │
│  Institutions are demanding:                             │
│  · Merchants Guild: Expand property rights              │
│  · Opposition: Limit state power                        │
│  · Community Assembly: Increase safety net              │
│                                                          │
│  Current consensus: 47% (60% needed to amend)           │
│  ████████████████████░░░░░░░░  47%                       │
│                                                          │
│  [Hold Current Constitution]  [Convene Amendment Summit]│
│                                                          │
│  ⚠ If held: political pressure continues to rise       │
│  ⚠ If amended: must negotiate with all institutions    │
└──────────────────────────────────────────────────────────┘
```

---

## 7. Institution Panel (click on institution in map)

```
┌──────────────────────────────┐
│ GOVERNING COUNCIL            │
│ ──────────────────────────── │
│ Power:       ████████░░ 78%  │
│ Legitimacy:  █████░░░░░ 48%  │
│ Budget:      180 / 500       │
│ ──────────────────────────── │
│ RECENT DECISIONS             │
│ · [Day 45] Announced inquiry │
│ · [Day 40] Dispersal order   │
│ ──────────────────────────── │
│ CURRENTLY NEGOTIATING WITH  │
│ · Market (private)           │
│ ──────────────────────────── │
│ PUBLIC PERCEPTION            │
│ Trust:      ███░░░░░░░ 34%   │
│ Competence: ████░░░░░░ 41%   │
└──────────────────────────────┘
```

---

## 8. UI Tech Stack

```
Render:     PixiJS (WebGL) — heatmap + 10k NPC flow
UI panels:  Vanilla HTML/CSS overlay on canvas
Narrative:  Gemini Flash 2.5 — writes event text
NPC thought: Gemini Flash 2.5 — called on spotlight click
State:      Plain JS object — no framework needed
```

No React/Vue — unnecessary overhead for this sim.  
Canvas handles the map. HTML overlay handles panels.

---

## Gameplay Loop Summary

```
1. SETUP (5 minutes)
   Choose society model → configure constitution → enter API key → start

2. OBSERVE (ongoing)
   Sim runs automatically — institutions make decisions via LLM
   Narrative feed updates continuously
   Macro indicators track danger thresholds

3. INJECT (as desired)
   Drop events in → observe cascade
   Timing matters more than event type

4. CRISIS (when threshold crossed)
   Constitutional crisis appears
   Decide: reform or hold the line
   Consequences last for many sim-years

5. REFLECT
   No win/lose
   The question: did the society you designed adapt or collapse?
   And why?
```
