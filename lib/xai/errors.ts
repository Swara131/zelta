export class GrokAgentBuilderError extends Error {
  readonly code = "GROK_AGENT_BUILD_ERROR";

  constructor(message: string) {
    super(message);
    this.name = "GrokAgentBuilderError";
  }
}

export class GrokServiceError extends Error {
  readonly code = "GROK_SERVICE_ERROR";

  constructor(message: string) {
    super(message);
    this.name = "GrokServiceError";
  }
}

export const AGENT_BUILD_PARSE_ERROR =
  "Could not parse description. Try a clearer sentence.";

export const GROK_SERVICE_UNAVAILABLE =
  "Service temporarily unavailable. Please try again.";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isGrokRateLimitError(err: unknown): boolean {
  const raw = err instanceof Error ? err.message : String(err);
  return raw.includes("429") || raw.toLowerCase().includes("rate limit");
}

export async function withGrokRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 2
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const retryable =
        err instanceof GrokServiceError || isGrokRateLimitError(err);
      if (!retryable || attempt >= maxRetries) {
        break;
      }
      console.warn(`Grok request failed (attempt ${attempt + 1}), retrying…`, err);
      await sleep(1_000 * (attempt + 1));
    }
  }

  if (lastError instanceof GrokServiceError) {
    throw lastError;
  }
  if (lastError instanceof Error) {
    throw new GrokServiceError(GROK_SERVICE_UNAVAILABLE);
  }
  throw new GrokServiceError(GROK_SERVICE_UNAVAILABLE);
}
