export class SecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SecurityError";
  }
}

export class ValidationError extends SecurityError {
  readonly details: string[];

  constructor(message: string, details: string[] = []) {
    super(message);
    this.name = "ValidationError";
    this.details = details;
  }
}

export class RateLimitError extends SecurityError {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super("Too many requests. Please try again later.");
    this.name = "RateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
