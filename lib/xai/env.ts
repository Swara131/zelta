export function getGrokApiKey(): string {
  const key = process.env.GROK_API_KEY?.trim();
  if (!key) {
    throw new Error("GROK_API_KEY is not configured.");
  }
  return key;
}

export function isGrokConfigured(): boolean {
  return Boolean(process.env.GROK_API_KEY?.trim());
}

export function getGrokModel(): string {
  return process.env.GROK_MODEL?.trim() || "grok-2";
}
