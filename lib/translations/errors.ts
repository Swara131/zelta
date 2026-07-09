export class TranslationDbError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TranslationDbError";
  }
}
