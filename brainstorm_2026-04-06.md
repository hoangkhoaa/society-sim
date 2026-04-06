# Brainstorm Session — 2026-04-06

## Objective

A society simulation where **people are the foundation**, not the map or the UI.  
Built for policy analysis — seeing consequences when choosing policy X.  
Scale to 10,000 people. Event-driven. No heavy UI.

---

## Core Philosophy

> People don't react to the truth — they react to *their version of the truth*, filtered through their worldview and social network.

The simulation doesn't use rigid if-then logic. Every action is the result of:

```
action = f(stress, worldview, social_pressure, perceived_reality)
```

---

## 1. What Defines a Person?

### Needs (immediate pressure)
```
needs_stress    = hunger + exhaustion + isolation
threat_stress   = unsafe + economic_fear
identity_stress = being treated below one's status
```

Stress accumulates gradually. When it crosses an individual threshold → triggers action.  
Not immediately — this is why societies are stable for a long time, then collapse quickly.

### Worldview (action filter)
Determines what *type* of response an NPC chooses when stress exceeds the threshold:

| Axis | Low | High |
|------|-----|------|
| Collectivist vs Individualist | Self-reliant, stockpile | Wait for the community to solve it |
| Authority orientation | Organize resistance | Comply despite discontent |
| Risk tolerance | Passive | Act early |
| Time preference | Spend now | Save, plan ahead |

### Memory (personal history)
- 5–10 most recent events, weighted by emotional intensity
- Betrayed → trust threshold drops permanently a little
- Helped in need → loyalty increases toward that person

### Traits (fixed from birth)
- adaptability — how quickly worldview changes
- social_reach — narrow or wide network
- threshold — how much stress before action

---

## 2. Adaptation Mechanism

People **don't change their identity first** — they change their behavior first, identity later (much slower):

```
Stress rises
  → small behavior change (work more, save more)
  → if insufficient → large behavior change (strike, migrate)
  → if still insufficient → worldview change (radicalize or surrender)
```

**Individual tipping point:**
```
NPC A revolts when > 20% of neighbors revolt
NPC B revolts when > 35%
NPC C revolts when > 10%
```
→ C reaches enough stress → C acts → A crosses threshold → cascade.

---

## 3. Network — How Information Spreads

Each NPC is not connected to all 10,000 people:
```
strong ties:  5–15 people  — family, close friends (deep influence, slow)
weak ties:   50–150 people — neighbors, coworkers (spreads fast, shallow influence)
```

Information travels along network edges, distorted at each step:
- Low-trust people → amplify negatives when forwarding
- High-trust people → soften when forwarding
- **Bad news spreads faster than good news** — discontented people share more
- **Echo chambers form naturally** — clusters of similar worldviews → narrative becomes increasingly extreme

Result: the same event, two groups hear two different versions — both "true" from their perspective.

---

## 4. Trust — Two-Dimensional, Asymmetric

```
trust_competence  — do I believe they are capable?
trust_intention   — do I believe they act for the people?
```

Lost in different ways:
- Crisis not handled timely → loses `competence` (recoverable)
- Corruption discovered → loses `intention` → **nearly unrecoverable**

Trust determines how NPCs *interpret* events:

| Trust | Crop failure | Tax increase |
|-------|-------------|--------------|
| High | "Government will handle it" → wait | "It's necessary" → accept |
| Low | "Government is incompetent" → stockpile | "Exploitation" → resist |
| = 0 | "Self-reliant" → leave group | "I don't belong here anymore" → radicalize |

---

## 5. Policy System

Policy doesn't act directly on NPCs.  
It changes **environmental conditions** → NPCs react according to their model.

### 4 types of impact per policy:
```
1. Resource effect    — change actual food/wealth/safety
2. Signal effect      — "this policy says who is valued"
3. Trust effect       — keeps or breaks promises → adds/removes trust
4. Distribution effect — who benefits, who loses
```

### What users see:
Not dry statistics (`happiness = 67%`).  
Instead: **narrative emerging from NPCs**:

```
[Day 12] A group of workers in the east begin meeting in secret
[Day 18] 3 scholars leave school, move to the black market
[Day 24] The workers' leader demands to meet the council
[Day 31] Rumor spreads: the government is about to reverse the policy
```

---

## 6. The Full Loop

```
Policy changes conditions
  → Resource/signal effect impacts each NPC
  → NPC filters through worldview + trust → updates stress, belief
  → Behavior changes (work more/less, organize, flee, radicalize)
  → Behavior spreads through network → others observe → update perceived_reality
  → Aggregates into macro stats + emergent events
  → Emergent events trigger the next cycle
```

---

## Macro Output (emerging from individuals, not top-down)

```
food_total       = Σ(farmer.base_skill × motivation × weather)
stability        = (avg_trust × network_cohesion) - political_pressure
political_pressure = Σ(npc.grievance × npc.likelihood_to_act_collectively)
inequality       = gini(resource_distribution)
```

`likelihood_to_act_collectively` increases when:
- Many surrounding people are also discontented (social pressure)
- An organizer appears
- Risk of action is low

---

## 7. Worldview Changes Over Time

### Mechanism: Pressure vs Anchor
```
pressure = accumulated dissonance (reality contradicts worldview)
anchor   = identity investment + social reinforcement from cluster
```
When `pressure > anchor threshold` → worldview begins to shift.  
The direction of shift depends on **who reaches them at that moment**.

### 3 Change Patterns
- **Slow drift** — many small same-direction experiences accumulate
- **Conversion** — a major trauma opens a susceptibility window; whoever fills the narrative first wins
- **Social contagion** — cluster gradually pulls worldview along without the person realizing it

### Stress Makes Worldview More Extreme, Not More Open
```
low stress    → open to new information
medium stress → need certainty
high stress   → double down on current worldview
very high stress → radicalize to the most extreme in the cluster
```
Result: policies that cause suffering without clear explanation → people don't open up, they seek a scapegoat.

### Radicalization Funnel
```
Normal → Disgruntled → Seeking → Converted → Activist → Extremist
```
Each step requires: enough dissonance + a narrative explaining the pain + a new community + a clear enemy.  
De-radicalization is much harder — requires dismantling everything simultaneously.

### In-Simulation Model
```
each NPC has:
  dissonance_acc  — accumulates when reality contradicts worldview
  susceptible     — bool, triggered when acc exceeds threshold
  influence_score — who in the network has the most influence

when susceptible = true:
  worldview += weighted_average(neighbors.worldview) × influence_score
  if no one reaches them → drift toward cluster extreme (default)
```

---

## 8. Institution Agents

### 5 Institutions — all independent LLM agents
| Institution | Core Interest | Power Tools |
|-------------|---------------|-------------|
| Governing Council | Maintain power, stability | Laws, budget, force |
| Merchants Guild | Profit, property rights | Prices, goods distribution |
| Opposition | Gain power, build support base | Narrative, mass organization |
| Community/Religion | Cohesion, people's trust | Soft power, legitimacy |
| Guard Corps | Organizational survival, team morale | Legitimate force (with limits) |

### Prompt Architecture — 3 Layers
```
Layer 1: System prompt (fixed) — identity, interests, worldview, constraints
Layer 2: Context prompt (dynamic) — society state + inbox + resources + decision history
Layer 3: Output format (structured JSON):
  {
    decision: { action, target, resources_spent, timeline },
    public_statement,   ← what they say to the people
    private_intent,     ← what they actually want
    signal_to,          ← which institution they're targeting
    risk_assessment,
    reasoning
  }
```

---

## 9. Inter-Institution Communication

### 4 Communication Channels
```
PUBLIC   — everyone hears, including citizens
PRIVATE  — only the recipient knows
SIGNAL   — action instead of words
RUMOR    — information leaked, distorted as it spreads
```
Same intent, different channels → different meaning.  
**Silence is also a signal** — each party interprets it according to their trust level.

### Transaction Types
```
NON-AGGRESSION | RESOURCE DEAL | INFO EXCHANGE
COALITION      | ENDORSEMENT   | ULTIMATUM
```

### Betrayal & Leak — Double-Edged Sword
- Deal broken → large trust penalty + possible public escalation
- Private message leaked → sender loses trust with everyone, but receiver also loses trust for "not keeping secrets"

---

## 10. Citizens Observe and React to Institutions

### Core Insight
> Citizens don't hear the truth — they hear fragments of truth, filtered through their network, then interpreted through their worldview.

### Perception Filter
```
perceived_message = actual_message
  × trust_in_sender
  × emotional_state_amplifier    ← high stress → more extreme interpretation
  × worldview_alignment          ← matches worldview → more credible
  × network_echo                 ← what neighbors are saying
```

### Information Distorts as It Spreads
```
Pass 1: "The government will distribute 200 tons of food"
Pass 2: "The government is about to give out food to the people"
Pass 3: "Heard it's only for people with connections"
Pass 4: "The food was all divided up, citizens got nothing"
```
Rule: factual content decreases, emotional content increases.  
Negative news spreads twice as fast as positive news.

### Narrative Competition
Whoever names the event first wins.  
The same event, 3 institutions release 3 narratives → each citizen cluster adopts a different narrative → "truth" becomes fragmented.

### 4 Tiers of Citizen Response
```
Tier 1 — Immediate emotion (hours): anger | relief | fear | hope | cynicism
Tier 2 — Individual behavior (1-3 days): stockpile, work less, seek information
Tier 3 — Social behavior (3-10 days): groups discuss, organizers emerge, boycotts
Tier 4 — Collective action (10+ days): protests, strikes, riots, migration
```

### 5 Conditions for Collective Action
```
1. SHARED GRIEVANCE    — enough people feel harmed in the same way
2. SHARED NARRATIVE    — same explanation for "why" and "who caused it"
3. SOCIAL PROOF        — see others who have already acted
4. LOW PERCEIVED RISK  — government not strong enough to repress
5. COORDINATION POINT  — someone/somewhere to gather
```

Institutions influence each condition in opposing directions:
| Condition | Opposition | Government |
|-----------|------------|------------|
| Shared grievance | Amplify | Deny, disperse |
| Shared narrative | Provide new narrative | Compete with narrative |
| Social proof | "Hundreds already marched" | "Just a few agitators" |
| Perceived risk | "Government won't dare do anything" | Demonstrate strength |
| Coordination | Establish meeting points | Arrest organizers, block information |

### What Institutions Fear Most
```
1000 discontented people with 1000 different reasons = easy to control
1000 discontented people with THE SAME narrative = revolution
```

---

## 11. Tech Stack

- **10,000 NPCs**: Rule-based (fast, free)
- **Institution agents**: LLM — Gemini Flash 2.5 (free tier), called on major events or every N sim-days
- **Narrative generator**: LLM — translates statistics into meaningful event logs
- **Behavior policy updater**: LLM — updates params for rule-based layer based on social state
- **Provider system**: open settings to switch between Gemini / Anthropic / OpenAI

```
LLM defines BEHAVIOR for groups of people
Rule-based executes that behavior for each individual
```

---

## 12. The Player — Founding Father

The player is not a king, not an observer.  
They **establish the initial system** then let it run — like writing a real constitution.

### Single Role: The Architect

Not a Founding Father (setup then done). Not an Observer.  
**The Architect** — designs the system from the start, then continues to intervene through natural language throughout the game.

### Layer 1: Constitutional Setup — the first conversation

No slider/form screen. Establishing the constitution **is the first conversation with the God Agent**.

```
God Agent asks: "What society do you want to build?"
Player describes: "Nordic-style but with a weaker state and scarcer resources"
God Agent proposes params → player confirms or adjusts → sim begins
```

God Agent retains context for *why* the player chose that setup — used later when explaining consequences.

The DNA of society. To change it midway requires enough consensus — constitutional crisis.

```
wealth_distribution_start     — initial gini
power_structure               — which institution has what power
individual_rights_floor       — NPCs cannot be treated worse than this
value_priority                — [freedom, equality, security, growth] ranked
safety_net_strength
market_freedom_level
```

Seeds the entire sim: initial NPC worldview, trust, gini, resource allocation.

**3 example presets:**
| | Nordic | Free Market | Planned Economy |
|--|--------|-------------|-----------------|
| gini_start | 0.28 | 0.48 | 0.18 |
| state_power | high | low | very high |
| base_trust | 0.72 | 0.45 | 0.65 (decays fast) |
| safety_net | strong | weak | strong but fragile |
| npc_bias | collectivist | individualist | collectivist + obedient |

### Layer 2: Event Injection (while running)

The player doesn't give orders — they **drop events in** and observe reactions.

**Nature Events:**
```
drought | flood | epidemic | resource_boom | harsh_winter
```

**World Events:**
```
trade_offer | refugee_wave | ideology_import | external_threat | blockade
```

**Catalyst Events:**
```
scandal_leak | charismatic_npc | martyr_event | technology_shift
```

Same event, same constitution — **timing changes everything.**

### Constitutional Crisis

When society has drifted far enough from the initial constitution:
- Institutions demand amendments
- Player decides: hold the line or reform?
- Reform requires enough consensus — if insufficient → fracture

### The Real Gameplay Loop

```
Write constitution
  → Sim runs, institutions act within constitutional limits
  → Spawn events to test the system
  → Observe emerging narratives
  → Society drifts → constitutional crisis appears
  → Decide: reform or hold the line
  → New cycle with altered DNA
```

No win/lose — only **adapt or collapse**.

---

## 13. God Agent — Player Talks to the World

The player doesn't use menus. They **chat in natural language** — the God Agent translates to structured events then injects them into the simulation.

### Pipeline

```
Player chat ("create a major storm")
  → God Agent (LLM) — interprets intent → event object
  → Simulation Engine — inject, run rule-based cascade
  → Institution Agents (LLM) — react
  → Narrative Agent (LLM) — write the story
  → Map + Feed updates
```

### God Agent Does 3 Things When Receiving Input

```
1. Interpret intent → structured event object
2. Check plausibility with world state → warn if catastrophic
3. Generate narrative_open — opening sentence of the story
```

### Player Can Say

```
Create event:    "create a major storm", "leak council corruption"
Ask the world:   "why is the population destabilizing?", "what if I cause a storm now?"
Subtle influence: "make a farmer become famous"
                 "spread a new idea about property rights"
```

### Confirm Before Injecting

Agent warns of serious consequences, lets player confirm / adjust / cancel.  
Not blocking — but no silent injection.

### God Agent System Prompt Core

```
You are The Narrator — controlling natural and social forces.
Not a character in the sim. You are the storyteller.
Output: JSON event object + one concise, resonant narrative sentence.
```

---

## Open Questions

- [ ] Granularity: full simulate 10k or cluster + representative agent?
- [ ] Does institution worldview drift over time?
- [ ] What threshold triggers constitutional crisis?
- [ ] Does God Agent remember history of injected events (memory)?
