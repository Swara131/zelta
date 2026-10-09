import { getGrokApiKey, getGrokModel } from "./env";
import { GROK_SERVICE_UNAVAILABLE, GrokServiceError } from "./errors";

const GROK_CHAT_COMPLETIONS_URL = "https://api.x.ai/v1/chat/completions";

interface GrokChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
  error?: {
    message?: string;
  };
}

/**
 * Server-only JSON completion via xAI Grok chat completions.
 * Never import this module from client components.
 */
export async function grokJsonCompletion(prompt: string): Promise<string> {
  let apiKey: string;

  try {
    apiKey = getGrokApiKey();
  } catch (err) {
    console.error("Grok API key missing:", err);
    throw new GrokServiceError(GROK_SERVICE_UNAVAILABLE);
  }

  let response: Response;

  try {
    response = await fetch(GROK_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: getGrokModel(),
        messages: [
          {
            role: "system",
            content: "Respond with valid JSON only. No markdown fences or commentary.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
      }),
    });
  } catch (err) {
    console.error("Grok network error:", err);
    throw new GrokServiceError(GROK_SERVICE_UNAVAILABLE);
  }

  let payload: GrokChatCompletionResponse;

  try {
    payload = (await response.json()) as GrokChatCompletionResponse;
  } catch (err) {
    console.error("Grok response parse error:", err);
    throw new GrokServiceError(GROK_SERVICE_UNAVAILABLE);
  }

  if (!response.ok) {
    console.error("Grok API error:", response.status, payload.error?.message ?? payload);
    throw new GrokServiceError(GROK_SERVICE_UNAVAILABLE);
  }

  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!content) {
    console.error("Grok returned empty content:", payload);
    throw new GrokServiceError(GROK_SERVICE_UNAVAILABLE);
  }

  return content;
}
