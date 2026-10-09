export class AgentRuntimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentRuntimeError";
  }
}

export class AgentRuntimeTimeoutError extends AgentRuntimeError {
  constructor(maxDurationMs: number) {
    super(`Agent run exceeded the ${Math.round(maxDurationMs / 1000)}s time limit.`);
    this.name = "AgentRuntimeTimeoutError";
  }
}

export class AgentRuntimeLimitError extends AgentRuntimeError {
  constructor(message: string) {
    super(message);
    this.name = "AgentRuntimeLimitError";
  }
}

export class AgentNotRunnableError extends AgentRuntimeError {
  constructor(message: string) {
    super(message);
    this.name = "AgentNotRunnableError";
  }
}
