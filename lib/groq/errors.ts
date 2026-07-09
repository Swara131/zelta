export class AiTranslationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiTranslationError";
  }
}

export class AiRiskAnalysisError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiRiskAnalysisError";
  }
}

export class AiProposalEnrichmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiProposalEnrichmentError";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function formatGroqError(
  err: unknown,
  kind: "translation" | "risk" | "proposal"
): AiTranslationError | AiRiskAnalysisError | AiProposalEnrichmentError {
  const raw = err instanceof Error ? err.message : String(err);
  const ErrorClass =
    kind === "translation"
      ? AiTranslationError
      : kind === "proposal"
        ? AiProposalEnrichmentError
        : AiRiskAnalysisError;

  if (raw.includes("429") || raw.toLowerCase().includes("rate limit")) {
    return new ErrorClass(
      "Groq API rate limit reached. Wait a moment and try again, or check usage at https://console.groq.com/."
    );
  }

  if (
    raw.toLowerCase().includes("api key") ||
    raw.includes("401") ||
    raw.includes("invalid_api_key")
  ) {
    return new ErrorClass(
      "Invalid Groq API key. Set GROQ_API_KEY in .env.local (from https://console.groq.com/keys)."
    );
  }

  if (raw.length > 280) {
    return new ErrorClass(`${raw.slice(0, 280)}…`);
  }

  return new ErrorClass(raw);
}

export function isGroqRateLimitError(err: unknown): boolean {
  const raw = err instanceof Error ? err.message : String(err);
  return raw.includes("429") || raw.toLowerCase().includes("rate limit");
}

export async function withGroqRetry<T>(
  fn: () => Promise<T>,
  kind: "translation" | "risk" | "proposal",
  maxRetries = 1
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!isGroqRateLimitError(err) || attempt >= maxRetries) {
        throw formatGroqError(err, kind);
      }
      await sleep(5_000);
    }
  }

  throw formatGroqError(lastError, kind);
}
