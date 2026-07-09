import Groq from "groq-sdk";
import {
  AiProposalEnrichmentError,
  AiRiskAnalysisError,
  AiTranslationError,
  formatGroqError,
} from "./errors";
import { getGroqApiKey, getGroqModel } from "./env";

let groqClient: Groq | undefined;

export function getGroqClient(): Groq {
  if (!groqClient) {
    groqClient = new Groq({ apiKey: getGroqApiKey() });
  }
  return groqClient;
}

/**
 * Server-only JSON completion via Groq chat API.
 * Never import this module from client components.
 */
export async function groqJsonCompletion(
  prompt: string,
  options?: { system?: string; kind?: "translation" | "risk" | "proposal" }
): Promise<string> {
  const kind = options?.kind ?? "translation";
  const groq = getGroqClient();

  const messages: Groq.Chat.Completions.ChatCompletionMessageParam[] = [];
  if (options?.system) {
    messages.push({ role: "system", content: options.system });
  }
  messages.push({ role: "user", content: prompt });

  try {
    const response = await groq.chat.completions.create({
      model: getGroqModel(),
      messages,
      temperature: 0.2,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      if (kind === "proposal") {
        throw new AiProposalEnrichmentError("Groq returned an empty response.");
      }
      throw kind === "risk"
        ? new AiRiskAnalysisError("Groq returned an empty response.")
        : new AiTranslationError("Groq returned an empty response.");
    }

    return content;
  } catch (err) {
    throw formatGroqError(err, kind);
  }
}
