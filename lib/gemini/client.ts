import { GoogleGenerativeAI } from "@google/generative-ai";
import { GeminiAgentBuilderError } from "./errors";
import { getGeminiApiKey, getGeminiModel } from "./env";

let geminiClient: GoogleGenerativeAI | undefined;

export function getGeminiClient(): GoogleGenerativeAI {
  if (!geminiClient) {
    geminiClient = new GoogleGenerativeAI(getGeminiApiKey());
  }
  return geminiClient;
}

/**
 * Server-only JSON completion via Gemini.
 * Never import this module from client components.
 */
export async function geminiJsonCompletion(prompt: string): Promise<string> {
  const model = getGeminiClient().getGenerativeModel({
    model: getGeminiModel(),
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
    },
  });

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text()?.trim();
    if (!text) {
      throw new GeminiAgentBuilderError("Gemini returned an empty response.");
    }
    return text;
  } catch (err) {
    if (err instanceof GeminiAgentBuilderError) {
      throw err;
    }
    const message = err instanceof Error ? err.message : "Gemini request failed.";
    throw new GeminiAgentBuilderError(message);
  }
}
