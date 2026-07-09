export class LogUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LogUploadError";
  }
}
