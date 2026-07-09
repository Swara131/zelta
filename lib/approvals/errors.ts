export class ApprovalEngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApprovalEngineError";
  }
}
