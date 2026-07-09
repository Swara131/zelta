export class AuditLogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuditLogError";
  }
}
