/** Brand prefix for generated agent API keys (e.g. al_a1b2c3d4_...). */
export const AGENT_KEY_BRAND = "al";

/** Length of the non-secret identifier segment after the brand. */
export const AGENT_KEY_ID_LENGTH = 8;

/** Entropy for the secret segment (32 bytes → base64url). */
export const AGENT_KEY_SECRET_BYTES = 32;

/** Minimum length for a well-formed agent API key. */
export const AGENT_KEY_MIN_LENGTH = 24;

export const AGENT_KEY_HEADER = "authorization";
