import type {
  AgentBuildParseResult,
  AllowedAgentTool,
  AllowedTriggerType,
} from "./parse-agent-build";

function includesAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

function parseThresholdInr(text: string): number {
  const match = text.match(/₹\s*([\d,]+)/);
  if (!match?.[1]) return 5_000;
  const value = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(value) && value > 0 ? value : 5_000;
}

function inferName(normalized: string, tools: AllowedAgentTool[]): string {
  if (includesAny(normalized, ["refund", "money back"])) return "refund-handler";
  if (includesAny(normalized, ["email", "e-mail", "mail"])) return "email-responder";
  if (includesAny(normalized, ["crm", "customer record", "update record"])) {
    return "crm-updater";
  }
  if (includesAny(normalized, ["alert", "notify", "notification"])) {
    return "alert-handler";
  }
  if (tools.includes("create_calendar_event")) return "calendar-agent";
  if (tools.includes("query_database")) return "data-agent";
  return "custom-agent";
}

function inferTrigger(normalized: string): AllowedTriggerType {
  if (includesAny(normalized, ["email", "e-mail", "mail"])) return "email";
  if (includesAny(normalized, ["schedule", "daily", "cron", "every hour"])) {
    return "schedule";
  }
  return "webhook";
}

/** Deterministic parser when Grok is unavailable — keeps the builder usable in dev/demo. */
export function buildFallbackAgentBuildParse(sentence: string): AgentBuildParseResult {
  const trimmed = sentence.trim();
  const normalized = trimmed.toLowerCase();

  const tools = new Set<AllowedAgentTool>();

  if (includesAny(normalized, ["search", "research", "news", "headlines", "look up", "latest"])) {
    tools.add("web_search");
  }
  if (includesAny(normalized, ["email", "e-mail", "mail", "message customer"])) {
    tools.add("send_email");
  }
  if (includesAny(normalized, ["whatsapp", "sms", "text message"])) {
    tools.add("send_whatsapp_message");
  }
  if (includesAny(normalized, ["refund", "money back", "₹", "inr"])) {
    tools.add("issue_refund");
  }
  if (includesAny(normalized, ["crm", "customer record", "update record", "update customer"])) {
    tools.add("update_crm_record");
  }
  if (includesAny(normalized, ["database", "sql", "postgres", "search records", "your data"])) {
    tools.add("query_database");
  }
  if (includesAny(normalized, ["calendar", "meeting", "schedule event", "book appointment"])) {
    tools.add("create_calendar_event");
  }
  if (includesAny(normalized, ["alert", "notify", "notification", "team member"])) {
    tools.add("send_email");
  }

  if (tools.size === 0) {
    tools.add("send_email");
  }

  const toolList = [...tools];
  const threshold = parseThresholdInr(trimmed);

  return {
    name: inferName(normalized, toolList),
    description: trimmed.endsWith(".") ? trimmed : `${trimmed}.`,
    tools: toolList,
    triggerType: inferTrigger(normalized),
    suggestedThreshold: threshold,
  };
}
