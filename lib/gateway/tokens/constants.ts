/** Brand prefix for execution tokens (e.g. et_a1b2c3d4_...). */
export const EXECUTION_TOKEN_BRAND = "et";

/** Length of the non-secret identifier segment after the brand. */
export const EXECUTION_TOKEN_ID_LENGTH = 8;

/** Entropy for the secret segment (32 bytes → base64url). */
export const EXECUTION_TOKEN_SECRET_BYTES = 32;

/** Minimum length for a well-formed execution token. */
export const EXECUTION_TOKEN_MIN_LENGTH = 24;

/** Short-lived TTL for execution tokens (seconds). */
export const EXECUTION_TOKEN_TTL_SECONDS = 15 * 60;
