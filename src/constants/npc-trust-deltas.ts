/**
 * Trust competence / intention deltas by event type (`sim/npc.ts` `updateTrust`).
 */

export type NpcTrustEvent =
  | 'promise_kept' | 'crisis_handled' | 'promise_broken'
  | 'corruption'   | 'helped_me'      | 'harmed_me' | 'silent_in_crisis'

export const NPC_TRUST_DELTAS: Record<NpcTrustEvent, { competence: number; intention: number }> = {
  promise_kept:     { competence: +0.03, intention: +0.02 },
  crisis_handled:   { competence: +0.05, intention: +0.03 },
  promise_broken:   { competence: -0.06, intention: -0.08 },
  corruption:       { competence: -0.05, intention: -0.20 },
  helped_me:        { competence: +0.02, intention: +0.04 },
  harmed_me:        { competence: -0.08, intention: -0.12 },
  silent_in_crisis: { competence: -0.04, intention: -0.06 },
}
