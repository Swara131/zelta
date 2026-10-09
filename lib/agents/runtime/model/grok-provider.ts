import { parseJsonText } from "@/lib/groq/json";
import { getGrokApiKey, getGrokModel, isGrokConfigured } from "@/lib/xai/env";
import { GROK_SERVICE_UNAVAILABLE, GrokServiceError } from "@/lib/xai/errors";
import type {
  ModelCompletionRequest,
  ModelMessage,
  ModelToolCallTurn,
  ModelTurn,
} from "../types";

const GROK_CHAT_COMPLETIONS_URL = "https://api.x.ai/v1/chat/completions";

function buildTurnPrompt(request: ModelCompletionRequest): string {
  const toolLines = request.enabledToolNames.map((name) => `- ${name}`).join("\n");

  return [
    "Task:",
    request.task,
    "",
    "Enabled tools:",
    toolLines,
    "",
    "Conversation so far:",
    JSON.stringify(request.messages.slice(-8)),
    "",
    "Return the next JSON turn (complete or tool_call).",
  ].join("\n");
}

function parseModelTurn(raw: unknown): ModelTurn {
  if (!raw || typeof raw !== "object") {
    throw new Error("Model returned invalid JSON.");
  }

  const record = raw as Record<string, unknown>;
  const type = typeof record.type === "string" ? record.type.trim().toLowerCase() : "";

  if (type === "complete") {
    const message = typeof record.message === "string" ? record.message.trim() : "";
    if (!message) throw new Error("Complete turn missing message.");
    return {
      type: "complete",
      message,
      reasoning: typeof record.reasoning === "string" ? record.reasoning : undefined,
    };
  }

  if (type === "tool_call") {
    const toolName = typeof record.toolName === "string" ? record.toolName.trim() : "";
    if (!toolName) throw new Error("Tool call missing toolName.");

    const toolInput =
      record.toolInput && typeof record.toolInput === "object" && !Array.isArray(record.toolInput)
        ? (record.toolInput as Record<string, unknown>)
        : {};

    return {
      type: "tool_call",
      toolName,
      toolInput,
      actionType: typeof record.actionType === "string" ? record.actionType : undefined,
      reasoning: typeof record.reasoning === "string" ? record.reasoning : undefined,
    } satisfies ModelToolCallTurn;
  }

  throw new Error(`Unknown model turn type: ${type || "missing"}`);
}

export async function grokModelTurn(
  request: ModelCompletionRequest,
  modelOverride?: string
): Promise<ModelTurn> {
  if (!isGrokConfigured()) {
    throw new GrokServiceError(GROK_SERVICE_UNAVAILABLE);
  }

  const apiKey = getGrokApiKey();
  const model = modelOverride?.trim() || getGrokModel();

  const messages: Array<{ role: string; content: string }> = [
    { role: "system", content: request.agent.systemPrompt },
    ...request.messages.map((message: ModelMessage) => ({
      role: message.role === "tool" ? "user" : message.role,
      content:
        message.role === "tool"
          ? `Tool result: ${message.content}`
          : message.content,
    })),
    { role: "user", content: buildTurnPrompt(request) },
  ];

  let response: Response;
  try {
    response = await fetch(GROK_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.2,
      }),
    });
  } catch {
    throw new GrokServiceError(GROK_SERVICE_UNAVAILABLE);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new GrokServiceError(GROK_SERVICE_UNAVAILABLE);
  }

  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new GrokServiceError(GROK_SERVICE_UNAVAILABLE);
  }

  const parsed = parseJsonText(content);
  return parseModelTurn(parsed);
}
