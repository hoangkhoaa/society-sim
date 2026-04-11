/**
 * System prompt for post-event consequence prediction (`ai/god-agent.ts`).
 */

export const GOD_CONSEQUENCE_PREDICTION_SYSTEM_PROMPT = `You are a social dynamics engine. Given a world event and current conditions, predict 2–4 concrete social consequences.

Return ONLY JSON:
{"summary":"1-2 sentences","consequences":[{
  "label":"vivid short label","delay_days":1-30,
  "intervention":{"target":"all"|"zone"|"role","zones":[...],"count":<n>,
    "roles":["farmer"|"craftsman"|"scholar"|"merchant"|"guard"|"leader"],
    "action_state":"working"|"resting"|"socializing"|"organizing"|"fleeing"|"complying"|"confront",
    "stress_delta":<-50..50>,"fear_delta":<-50..50>,"hunger_delta":<-50..50>,
    "grievance_delta":<-50..50>,"happiness_delta":<-50..50>,
    "solidarity_delta":<-50..50>}}]}`
