/**
 * NPC stance classification + policy reaction sampling (`sim/government.ts`).
 */

// --- Worldview / trust thresholds for classifyNPCPolicyStance ---

export const POLICY_LOYALIST_AUTHORITY_FLOOR = 0.65

export const POLICY_LOYALIST_GOV_TRUST_FLOOR = 0.55

export const POLICY_DISSIDENT_AUTHORITY_CEIL = 0.30

export const POLICY_DISSIDENT_GOV_TRUST_CEIL = 0.28

export const POLICY_SKEPTIC_AUTHORITY_CEIL = 0.44

export const POLICY_SKEPTIC_GOV_TRUST_CEIL = 0.42

// --- Network spread of policy reactions ---

/** Cap info_ties walked for ideological influence (performance + diminishing returns). */
export const POLICY_MAX_INFLUENCE_TIES = 10

/** Worldview diff above this dampens peer influence (polarization resistance). */
export const POLICY_POLARIZATION_RESISTANCE_THRESHOLD = 0.45

export const POLICY_LOYALIST_AUTHORITY_INFLUENCE = 0.003

export const POLICY_DISSIDENT_AUTHORITY_INFLUENCE = -0.003

export const POLICY_DISSIDENT_GRIEVANCE_INFLUENCE = 1.5

export const POLICY_SKEPTIC_GRIEVANCE_INFLUENCE = -0.5

// --- Reaction thought sampling ---

export const POLICY_THOUGHT_SAMPLE_RATE = 0.10

export const POLICY_MIN_THOUGHT_SAMPLE = 5

export const POLICY_MAX_THOUGHT_SAMPLE = 50

/** Dissident may flip to organizing on policy announcement. */
export const POLICY_DISSIDENT_ORGANIZING_PROBABILITY = 0.08
