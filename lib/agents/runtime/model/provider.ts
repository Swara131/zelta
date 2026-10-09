import { isGroqConfigured } from "@/lib/groq/env";
import { isWebSearchConfigured } from "@/lib/agents/tools/handlers/web-search";
import type { ModelCompletionRequest, ModelTurn } from "../types";
import { fallbackModelTurn } from "./fallback-provider";
import { groqModelTurn } from "./groq-provider";
import { taskNeedsWebResearch } from "./task-intent";

export async function requestModelTurn(
  request: ModelCompletionRequest
): Promise<ModelTurn> {
  const useTavilyResearch =
    isWebSearchConfigured() &&
    request.enabledToolNames.includes("web_search") &&
    taskNeedsWebResearch(request.task, request.agent);

  if (useTavilyResearch) {
    return fallbackModelTurn(request);
  }

  if (isGroqConfigured()) {
    try {
      return await groqModelTurn(request);
    } catch (err) {
      const groqError = err instanceof Error ? err.message : String(err);
      console.warn("[runtime] Groq model turn failed, using execution fallback:", groqError);
      return fallbackModelTurn(request, groqError);
    }
  }

  return fallbackModelTurn(request);
}
