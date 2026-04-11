/**
 * Cross-module DOM events and NPC chat summarisation limits (`ui/spotlight.ts`).
 */

/** `CustomEvent` name — `main.ts` listens to refresh NPC contacts panel. */
export const SPOTLIGHT_NPC_CONTACTS_CHANGED_EVENT = 'npc-contacts-changed'

/** Max chars when compressing chat into `npc.chat_summary`. */
export const SPOTLIGHT_CHAT_SUMMARY_MAX_LENGTH = 300

/** Minimum user/assistant turns before requesting an LLM summary. */
export const SPOTLIGHT_CHAT_SUMMARY_MIN_TURNS = 3
