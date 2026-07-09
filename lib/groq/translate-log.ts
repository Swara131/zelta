import type { TranslatedAction } from "@/lib/translator-types";
import { groqJsonCompletion } from "./client";
import { AiTranslationError, withGroqRetry } from "./errors";
import { parseJsonText, parseTranslationsPayload } from "./json";

const MAX_LOG_CHARS = 80_000;
const MAX_LINES = 80;

const BUSINESS_IMPACTS = new Set([
  "critical",
  "high",
  "medium",
  "low",
  "none",
]);

export { AiTranslationError };

function parseLogLines(content: string): { lineNumber: number; text: string }[] {
  const trimmed = content.slice(0, MAX_LOG_CHARS);
  return trimmed
    .split(/\r?\n/)
    .map((text, index) => ({ lineNumber: index + 1, text: text.trim() }))
    .filter((line) => line.text.length > 0)
    .slice(0, MAX_LINES);
}

function buildPrompt(lines: { lineNumber: number; text: string }[]): string {
  const numberedLog = lines.map((l) => `${l.lineNumber}: ${l.text}`).join("\n");

  return `You are a senior security analyst. Translate technical AI agent action logs into clear plain English for business and compliance stakeholders.

For EACH numbered log line below, return exactly one translation object with the same lineNumber.

Rules:
- action: short human-readable title (max 8 words)
- explanation: 2-3 sentences, non-technical, state risk and business context
- affectedSystem: system/service impacted
- affectedUser: user(s) or "N/A (system operation)"
- timestamp: extract from the log line if present, else use empty string
- businessImpact: one of critical, high, medium, low, none
- aiConfidence: integer 0-100 reflecting translation certainty

Return ONLY valid JSON (no markdown) with this exact shape:
{"translations":[{"lineNumber":1,"action":"...","explanation":"...","affectedSystem":"...","affectedUser":"...","timestamp":"...","businessImpact":"medium","aiConfidence":85}]}

LOG:
${numberedLog}`;
}

function normalizeRow(
  row: ReturnType<typeof parseTranslationsPayload>[number],
  fallbackLine: number
): Omit<TranslatedAction, "id"> {
  const impact = row.businessImpact?.toLowerCase();
  const businessImpact = BUSINESS_IMPACTS.has(impact ?? "")
    ? (impact as TranslatedAction["businessImpact"])
    : "medium";

  const confidence = Math.min(
    100,
    Math.max(0, Math.round(Number(row.aiConfidence) || 75))
  );

  return {
    lineNumber: Number(row.lineNumber) || fallbackLine,
    action: row.action?.trim() || "Agent action",
    explanation:
      row.explanation?.trim() ||
      "The agent performed an action that requires review.",
    affectedSystem: row.affectedSystem?.trim() || "Unknown system",
    affectedUser: row.affectedUser?.trim() || "Unknown",
    timestamp: row.timestamp?.trim() || new Date().toISOString(),
    businessImpact,
    aiConfidence: confidence,
  };
}

function toTranslatedActions(
  rows: ReturnType<typeof parseTranslationsPayload>
): TranslatedAction[] {
  return rows.map((row, index) => {
    const normalized = normalizeRow(row, index + 1);
    return {
      ...normalized,
      id: `t-${normalized.lineNumber}-${index}`,
    };
  });
}

export async function translateLogWithGroq(
  logContent: string
): Promise<TranslatedAction[]> {
  const lines = parseLogLines(logContent);

  if (lines.length === 0) {
    throw new AiTranslationError("Log file has no readable lines to translate.");
  }

  const rawText = await withGroqRetry(
    () =>
      groqJsonCompletion(buildPrompt(lines), {
        system:
          "You output only valid JSON objects. Never use markdown fences or prose.",
        kind: "translation",
      }),
    "translation"
  );

  let parsed: unknown;
  try {
    parsed = parseJsonText(rawText);
  } catch {
    throw new AiTranslationError("Groq returned invalid JSON for translations.");
  }

  const rows = parseTranslationsPayload(parsed);
  return toTranslatedActions(rows);
}
