# Society Sim

<div align="center">

[![Live Demo](https://img.shields.io/badge/▶%20Play%20Live-GitHub%20Pages-4A90E2?style=for-the-badge&logo=github)](https://hoangkhoaa.github.io/society-sim/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![PixiJS](https://img.shields.io/badge/PixiJS-8.0-E91E63?style=for-the-badge)](https://pixijs.com/)
[![Vite](https://img.shields.io/badge/Vite-5.2-646CFF?style=for-the-badge&logo=vite)](https://vitejs.dev/)

**A living world. You set the rules — then watch 500 citizens adapt or collapse.**

[![Game Screenshot](https://github.com/user-attachments/assets/d0998ef1-aaeb-43b6-a6e3-7137fc5ca34d)](https://hoangkhoaa.github.io/society-sim/)

</div>

---

## 🧠 Core Idea

You are not the king. You are **The Narrator**.

Design a society from a constitution (Nordic? Feudal? Commune?), then drop events into it and observe.  
Type *"create a major storm"* — an AI agent injects it as a structured event: merchants stockpile, the government convenes, the press publishes headlines, rumors spread through ideological networks, dissidents organize. Nobody obeys you. They react according to who they are.

**No win. No lose.** Only the question: does your society hold together — or fracture?

---

## 🎮 Play Now

**No installation.** Just open:

> **[https://hoangkhoaa.github.io/society-sim/](https://hoangkhoaa.github.io/society-sim/)**

- **No API key needed** — the full simulation runs rule-based in your browser
- Add a **Gemini / Claude / GPT-4o / Ollama** key to unlock natural-language events, AI-driven institutions, and richer press headlines

---

## 🚀 Getting Started

<table>
  <tr>
    <td align="center" width="50%">
      <img src="https://github.com/user-attachments/assets/5871e2c2-bd97-43be-9a8a-ca65cb84cc46" alt="Onboarding — choose your AI provider" width="100%"/>
      <sub><b>Step 1 — Choose AI Provider</b><br/>Connect Gemini, Claude, GPT-4o, Ollama, or play free without any key</sub>
    </td>
    <td align="center" width="50%">
      <img src="https://github.com/user-attachments/assets/fb75ee1d-5ad5-486c-9cd7-3f1af9e63f90" alt="Society Setup — pick a preset" width="100%"/>
      <sub><b>Step 2 — Design Your Society</b><br/>Pick a preset or describe your society in natural language</sub>
    </td>
  </tr>
</table>

**Step 1 — Connect an AI provider** (or skip for rule-based mode).  
**Step 2 — Design your Constitution.** Choose a preset or describe it in free text (AI mode):

| Preset | Character |
|--------|-----------|
| 🏔 Nordic | High trust, strong safety net, low inequality |
| 💹 Free Market | Low state power, high inequality, entrepreneurial |
| ⚙ Planned Economy | Collectivist, redistributive, state-directed |
| ⚔️ Feudalism | Rigid hierarchy, low mobility, high gini |
| ⛪ Theocracy | Authority-heavy, ideological conformity |
| 🧠 Technocracy | Scholar-led, meritocratic |
| 🗡 Warlord State | Fragmented, high fear, low institutional trust |
| 🌿 Commune | Egalitarian, decentralized, high solidarity |
| ☭ Marxist | State ownership, planned economy, collectivist |

The constitution becomes the DNA of your society — shaping citizen worldviews, institutional power, wealth distribution, and work culture.

**Step 3 — Observe.** The sim runs at 1 sim-hour per real second (1×/3×/10×). Watch macro stats shift, story cards fire, and the chronicle fill with emergent history.

**Step 4 — Talk to the World** *(AI key required)*:
```
"create a famine in the south"
"leak corruption info about the council"
"what would happen if I triggered a military coup?"
```
The God Agent interprets, warns of predicted consequences, then injects the event.

---

## 👥 Citizens

Each of the 500 NPCs is not just a dot on a map. They have:

- **Needs** — hunger, exhaustion, loneliness, fear; each decays every tick
- **Worldview** — collectivist ↔ individualist, trusting ↔ distrustful of authority
- **Memory** — last 10 significant experiences (betrayals, crises, help, windfalls) → trust drift
- **Social network** — 5–15 strong ties · 50–150 weak ties · 10–40 ideological info-ties
- **Work rhythm** — personal `bio_clock_offset` + one of 6 motivation types (`survival` · `duty` · `achievement` · …)
- **Class solidarity** — spreads among same-role neighbors; fuels collective action and strikes
- **Romance & family** — courtship, marriage, children, mentorship, heartbreak cooldown
- **Burnout** — 20 sim-days of sustained high stress + exhaustion triggers collapse

They don't take orders. They react to accumulated pressure, filtered through their own worldview, propagated through their networks. The same event hits everyone differently.

---

## 🏛 Institutions & AI Layers

Five institutions — **Government, Market, Opposition, Community, Guard** — act as autonomous agents.  
They hold resources, legitimacy, and power; send messages to each other; issue policies; read the press.

| AI Layer | Role | Frequency |
|----------|------|-----------|
| **God Agent** | Translates player chat → structured events, answers questions, predicts consequences | Per message |
| **Institution Agents** | Each institution decides policy based on current societal signals and press headlines | Every 15 sim-days |
| **Free Press** | Generates headlines from societal signals; briefed to institutions before each cycle | Every 5 sim-days |

> 500 NPCs run **rule-based** — fast, deterministic, zero token cost. AI is only invoked where judgment is needed.

---

## ⚙️ Key Mechanics

**Social Networks (3 layers)** — strong ties (illness, trade), weak ties (solidarity spread), info-ties (ideological echo chambers, rumor propagation). Each NPC has a `bridge_score` reflecting how many community clusters they connect.

**Political Factions** — NPCs self-organize around shared values (`security` · `equality` · `freedom` · `growth`) and take collective action every 10 sim-days.

**Technology Tree** — scholars accumulate research points; milestones permanently change the world (advanced agriculture, folk medicine, trade networks, printing & record-keeping).

**Free Press** — scans societal signals every 5 sim-days, generates headlines (LLM or ~100 templates), feeds context to institution agents.

**Labor Strikes** — when a role's solidarity × grievance crosses the threshold, that class stops working. Demands: wages · conditions · rights. Government can intervene via policy.

**Rumor System** — events seed rumors that spread through info-ties, eroding or boosting trust in institutions over time.

**Narrative Engine** — fires 0–2 story events per sim-day (rags-to-riches, fall from grace, star-crossed lovers, conspiracies…). Major events show a cinematic **story card** on the map.

**Events (23 types)** — `storm` · `drought` · `epidemic` · `scandal_leak` · `refugee_wave` · `nuclear_explosion` · `volcanic_eruption` · and more. Events cascade, apply per-tick effects, and can trigger follow-up events.

**Macro Stats** — 10 indicators tracked live: Stability · Food · Resources · Energy · Trust · Gini · Labor Unrest · Polarization · Literacy · Political Pressure.

---

## 🗺️ The World

Nine zones, each with distinct roles: 🌾 Northern Fields · 🏫 Academy Hill · 🏘 West Village · 🏛 Town Square · 🏪 Market Quarter · ⚔️ The Garrison · 🌿 Southern Pastures · 🔨 Artisan Row · 🏚 East Settlement.

---

## 🛠️ Tech Stack

| | |
|---|---|
| Renderer | PixiJS 8 (WebGL) — zone heatmap + NPC dots |
| Simulation | Pure TypeScript, no framework, runs entirely in-browser |
| AI default | Gemini Flash 2.5 (free tier) |
| AI alternatives | Claude · GPT-4o Mini · Ollama (local/remote) |
| i18n | English / Vietnamese |

---

## 🗂️ Project Structure

```
src/
├── ai/           — God Agent + unified AI provider adapter
├── sim/          — Engine, NPC lifecycle, network, government, factions, press, tech, narratives
├── ui/           — Map (PixiJS), feed, spotlight, story cards, modals
├── local/        — Text templates (policy reactions, press, narratives)
├── types.ts      — Complete type system
├── i18n.ts       — English / Vietnamese strings
└── main.ts       — Entry point, UI controller, sim loop
```

---

## 💻 Local Development

```bash
git clone https://github.com/hoangkhoaa/society-sim.git
cd society-sim
npm install
npm run dev        # → http://localhost:5173/society-sim/
npm run build      # Production build → dist/
npx tsc --noEmit   # Type-check only
```

---

<div align="center">

Made with ❤️ · [Play Live →](https://hoangkhoaa.github.io/society-sim/)

</div>
