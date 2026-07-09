import type { TranslatedAction } from "@/lib/translator-types";
import type { DetectedRisk, RelatedEvent, RiskSeverity } from "@/lib/risk-types";
import {
  computeDistribution,
  deriveOverallScore,
  sortRisksBySeverity,
} from "@/lib/risk/analysis";
import { groqJsonCompletion } from "./client";
import { AiRiskAnalysisError, withGroqRetry } from "./errors";
import {
  parseJsonText,
  parseRiskPayload,
  type ParsedRiskRow,
} from "./json";

export { AiRiskAnalysisError };

const SEVERITIES = new Set(["critical", "high", "medium", "low"]);

function normalizeSeverity(value?: string): RiskSeverity {
  const lower = value?.toLowerCase();
  return SEVERITIES.has(lower ?? "") ? (lower as RiskSeverity) : "medium";
}

function normalizeRelatedEvents(
  events: ParsedRiskRow["relatedEvents"],
  index: number
): RelatedEvent[] {
  if (!Array.isArray(events)) return [];

  return events.slice(0, 5).map((event, eventIndex) => ({
    id: `ev-${index}-${eventIndex}`,
    title: event.title?.trim() || "Related event",
    timestamp: event.timestamp?.trim() || new Date().toISOString(),
    severity: normalizeSeverity(event.severity),
  }));
}

function normalizeRisk(row: ParsedRiskRow, index: number): DetectedRisk {
  const severity = normalizeSeverity(row.riskLevel ?? row.severity);

  return {
    id: `risk-${index + 1}`,
    title: row.title?.trim() || "Detected risk",
    severity,
    explanation:
      row.reason?.trim() ||
      row.explanation?.trim() ||
      "A security-relevant agent action requires review.",
    businessImpact:
      row.businessImpact?.trim() || "Potential operational or data impact.",
    complianceImpact:
      row.complianceImpact?.trim() ||
      "May affect access control and audit requirements.",
    mitreAttack: {
      tactic: row.mitreAttack?.tactic?.trim() || "Unknown",
      technique: row.mitreAttack?.technique?.trim() || "Unknown",
      techniqueId: row.mitreAttack?.techniqueId?.trim() || "T0000",
    },
    owaspCategory: row.owaspCategory?.trim() || "A01:2021 – Broken Access Control",
    suggestedAction:
      row.suggestedAction?.trim() || "Review and approve or block the action.",
    confidence: Math.min(100, Math.max(0, Math.round(Number(row.confidence) || 80))),
    aiRecommendation:
      row.aiRecommendation?.trim() ||
      "Escalate to security for validation and remediation.",
    relatedEvents: normalizeRelatedEvents(row.relatedEvents, index),
    detectedAt: row.detectedAt?.trim() || new Date().toISOString(),
    sourceLog: row.sourceLog?.trim() || "Translated agent log entry",
  };
}

function buildPrompt(translations: TranslatedAction[]): string {
  const payload = translations.map((t) => ({
    lineNumber: t.lineNumber,
    action: t.action,
    explanation: t.explanation,
    affectedSystem: t.affectedSystem,
    affectedUser: t.affectedUser,
    timestamp: t.timestamp,
    businessImpact: t.businessImpact,
    aiConfidence: t.aiConfidence,
  }));

  return `You are a principal security analyst performing enterprise risk assessment on AI agent actions that were already translated to plain English.

Analyze the translated actions below. Identify distinct security risks (merge related lines when appropriate).

For EACH risk you MUST provide:
- riskLevel (critical | high | medium | low)
- confidence (0-100 integer)
- businessImpact (plain English)
- complianceImpact (plain English, e.g. SOC2, GDPR, HIPAA relevance)
- reason (why this is a risk — clear plain English)
- suggestedAction (specific remediation step)
- title (short risk name)

Also include MITRE ATT&CK mapping, OWASP category, and related events when applicable.

Return ONLY valid JSON (no markdown) with this shape:
{
  "overallScore": number (0-100),
  "riskLevel": "critical" | "high" | "medium" | "low",
  "risks": [
    {
      "title": string,
      "riskLevel": "critical" | "high" | "medium" | "low",
      "confidence": number,
      "businessImpact": string,
      "complianceImpact": string,
      "reason": string,
      "suggestedAction": string,
      "mitreAttack": { "tactic": string, "technique": string, "techniqueId": string },
      "owaspCategory": string,
      "aiRecommendation": string,
      "relatedEvents": [{ "title": string, "timestamp": string, "severity": string }],
      "detectedAt": string (ISO),
      "sourceLog": string
    }
  ]
}

TRANSLATED ACTIONS:
${JSON.stringify(payload, null, 2)}`;
}

export async function analyzeRiskWithGroq(
  translations: TranslatedAction[]
): Promise<{
  overallScore: number;
  riskLevel: RiskSeverity;
  totalDetected: number;
  analyzedLogs: number;
  distribution: ReturnType<typeof computeDistribution>;
  risks: DetectedRisk[];
}> {
  if (translations.length === 0) {
    throw new AiRiskAnalysisError("No translated actions to analyze.");
  }

  const rawText = await withGroqRetry(
    () =>
      groqJsonCompletion(buildPrompt(translations), {
        system:
          "You output only valid JSON objects. Never use markdown fences or prose.",
        kind: "risk",
      }),
    "risk"
  );

  let parsed: unknown;
  try {
    parsed = parseJsonText(rawText);
  } catch {
    throw new AiRiskAnalysisError("Groq returned invalid JSON for risk analysis.");
  }

  const validated = parseRiskPayload(parsed);
  const risks = sortRisksBySeverity(
    validated.risks.map((row, index) => normalizeRisk(row, index))
  );

  if (risks.length === 0) {
    throw new AiRiskAnalysisError("Groq did not detect any risks.");
  }

  const derived = deriveOverallScore(risks);
  const overallScore = Math.min(
    100,
    Math.max(0, Math.round(Number(validated.overallScore) || derived.overallScore))
  );
  const riskLevel = SEVERITIES.has(validated.riskLevel?.toLowerCase() ?? "")
    ? (validated.riskLevel!.toLowerCase() as RiskSeverity)
    : derived.riskLevel;

  return {
    overallScore,
    riskLevel,
    totalDetected: risks.length,
    analyzedLogs: translations.length,
    distribution: computeDistribution(risks),
    risks,
  };
}
