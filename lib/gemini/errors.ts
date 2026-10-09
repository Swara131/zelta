export class GeminiAgentBuilderError extends Error {
  readonly code = "GEMINI_AGENT_BUILD_ERROR";

  constructor(message: string) {
    super(message);
    this.name = "GeminiAgentBuilderError";
  }
}

export const AGENT_BUILD_PARSE_ERROR =
  "Could not parse your description. Try a clearer sentence.";
