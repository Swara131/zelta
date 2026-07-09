export class EmailNotificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailNotificationError";
  }
}
