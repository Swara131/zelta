import { buildFallbackAgentSpec } from "@/lib/agent-builder/fallback-spec";
import { slugifyAgentId } from "@/lib/agent-builder/slug";
import type { AgentSpec, ProtectionLevel } from "@/lib/agent-builder/types";
import { groqJsonCompletion } from "./client";
import { AiAgentBuilderError, withGroqRetry } from "./errors";
import { getGroqModel } from "./env";
import { parseAgentSpecPayload, parseJsonText } from "./json";

export { AiAgentBuilderError };

const PROTECTION_LEVELS = new Set<ProtectionLevel>(["allow", "review", "block"]);

function normalizeProtectionLevel(value: string): ProtectionLevel {
  const normalized = value.toLowerCase();
  if (PROTECTION_LEVELS.has(normalized as ProtectionLevel)) {
    return normalized as ProtectionLevel;
  }
  if (normalized.includes("auto") || normalized.includes("allow")) {
    return "allow";
  }
  if (normalized.includes("block") || normalized.includes("never")) {
    return "block";
  }
  return "review";
}

function toolIcon(toolName: string): string {
  const name = toolName.toLowerCase();
  if (name.includes("email") || name.includes("mail")) return "📧";
  if (name.includes("refund") || name.includes("payment")) return "💳";
  if (name.includes("delete")) return "🗑️";
  if (name.includes("read") || name.includes("lookup")) return "🔍";
  if (name.includes("update") || name.includes("record")) return "📝";
  return "🤖";
}

function buildPrompt(description: string): string {
  return `You help non-technical founders define AI agents for the Wave safety platform.

The user described what they want their agent to do:
"""
${description}
"""

Return ONLY valid JSON (no markdown) with this exact shape:
{
  "name": "Short agent name like Customer Refund Agent",
  "summary": "One plain-English sentence describing what the agent does",
  "tools": [
    {
      "id": "snake_case_id",
      "label": "Human label like Send email",
      "toolName": "snake_case_tool_name",
      "actionType": "category.action"
    }
  ],
  "protection": [
    {
      "level": "allow" | "review" | "block",
      "label": "Short rule label",
      "description": "Plain English explanation for a founder"
    }
  ]
}

Rules:
- Use simple language a founder understands
- Include 1-4 tools the agent likely needs
- Include 2-5 protection rules with plain-English labels founders understand
- Use allow for automatic actions, review for "ask me first", block for never allowed
- For INR refunds: allow "Refund up to ₹5,000", review "Refund above ₹5,000", block "Delete customer records"
- Never claim the agent is already connected or deployed`;
}

function toAgentSpec(description: string, raw: ReturnType<typeof parseAgentSpecPayload>): AgentSpec {
  const name = raw.name.trim();
  return {
    name,
    agentId: slugifyAgentId(name),
    summary: raw.summary.trim(),
    purpose: description.trim(),
    tools: raw.tools.map((tool) => ({
      id: tool.id,
      label: tool.label,
      icon: toolIcon(tool.toolName),
      toolName: tool.toolName,
      actionType: tool.actionType,
    })),
    protection: raw.protection.map((rule) => ({
      level: normalizeProtectionLevel(rule.level),
      label: rule.label.trim(),
      description: rule.description.trim(),
    })),
    generatedAt: new Date().toISOString(),
    source: "groq",
    model: getGroqModel(),
  };
}

export async function generateAgentSpecFromDescription(
  description: string
): Promise<AgentSpec> {
  const trimmed = description.trim();
  if (trimmed.length < 10) {
    throw new AiAgentBuilderError(
      "Describe what your agent should do in a bit more detail."
    );
  }

  if (!process.env.GROQ_API_KEY?.trim()) {
    return buildFallbackAgentSpec(trimmed);
  }

  try {
    const rawText = await withGroqRetry(
      () =>
        groqJsonCompletion(buildPrompt(trimmed), {
          kind: "agent-builder",
          system:
            "Respond with valid JSON only. Write for non-technical founders.",
        }),
      "agent-builder"
    );

    const parsed = parseAgentSpecPayload(parseJsonText(rawText));
    return toAgentSpec(trimmed, parsed);
  } catch {
    return buildFallbackAgentSpec(trimmed);
  }
}
