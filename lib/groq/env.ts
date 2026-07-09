function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Missing environment variable: ${name}. Add it to .env.local (see .env.example).`
    );
  }
  return value;
}

export function getGroqApiKey(): string {
  return requireEnv("GROQ_API_KEY");
}

/** Default model — override with GROQ_MODEL in .env.local if needed. */
export function getGroqModel(): string {
  return process.env.GROQ_MODEL?.trim() ?? "llama-3.3-70b-versatile";
}
