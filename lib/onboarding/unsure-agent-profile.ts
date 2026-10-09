export type AgentCapabilityId =
  | "answer_questions"
  | "send_emails"
  | "access_customer_info"
  | "process_refunds"
  | "make_payments"
  | "update_records"
  | "other";

export interface AgentCapabilityOption {
  id: AgentCapabilityId;
  label: string;
  /** Plain-language phrase for the summary sentence. */
  phrase: string;
}

export const AGENT_CAPABILITY_OPTIONS: readonly AgentCapabilityOption[] = [
  {
    id: "answer_questions",
    label: "Answer questions",
    phrase: "answers customer questions",
  },
  {
    id: "send_emails",
    label: "Send emails",
    phrase: "sends emails",
  },
  {
    id: "access_customer_info",
    label: "Access customer information",
    phrase: "accesses customer information",
  },
  {
    id: "process_refunds",
    label: "Process refunds",
    phrase: "handles refunds",
  },
  {
    id: "make_payments",
    label: "Make payments",
    phrase: "makes payments",
  },
  {
    id: "update_records",
    label: "Update records",
    phrase: "updates records",
  },
  {
    id: "other",
    label: "Other",
    phrase: "performs other tasks you described",
  },
] as const;

export interface UnsureAgentProfile {
  title: string;
  summary: string;
}

function joinPhrases(phrases: string[]): string {
  if (phrases.length === 0) {
    return "Works on tasks you described.";
  }
  if (phrases.length === 1) {
    const first = phrases[0]!;
    return `${first.charAt(0).toUpperCase()}${first.slice(1)}.`;
  }
  if (phrases.length === 2) {
    const combined = `${phrases[0]} and ${phrases[1]}`;
    return `${combined.charAt(0).toUpperCase()}${combined.slice(1)}.`;
  }
  const head = phrases.slice(0, -1).join(", ");
  const tail = phrases[phrases.length - 1];
  const combined = `${head}, and ${tail}`;
  return `${combined.charAt(0).toUpperCase()}${combined.slice(1)}.`;
}

function inferAgentTitle(
  capabilities: readonly AgentCapabilityId[],
  description: string
): string {
  const normalized = description.toLowerCase();
  const has = (id: AgentCapabilityId) => capabilities.includes(id);

  const customerFacing =
    has("answer_questions") ||
    has("access_customer_info") ||
    has("send_emails") ||
    normalized.includes("customer") ||
    normalized.includes("support");

  const financial =
    has("process_refunds") || has("make_payments") || normalized.includes("refund");

  const operations = has("update_records") || normalized.includes("record");

  if (customerFacing && financial) {
    return "Customer Support Agent";
  }
  if (customerFacing) {
    return "Customer Support Agent";
  }
  if (financial && !has("answer_questions")) {
    return "Financial Operations Agent";
  }
  if (operations && !customerFacing) {
    return "Operations Agent";
  }
  if (has("send_emails") && has("answer_questions")) {
    return "Communication Agent";
  }
  if (has("other") && description.trim().length > 0) {
    return "Custom AI Agent";
  }
  return "AI Agent";
}

export function buildUnsureAgentProfile(input: {
  description: string;
  capabilities: readonly AgentCapabilityId[];
}): UnsureAgentProfile {
  const { description, capabilities } = input;
  const trimmedDescription = description.trim();

  const phrases = AGENT_CAPABILITY_OPTIONS.filter(
    (option) =>
      capabilities.includes(option.id) &&
      !(option.id === "other" && trimmedDescription.length === 0)
  ).map((option) => option.phrase);

  let summary = joinPhrases(phrases);

  if (capabilities.includes("other") && trimmedDescription.length > 0) {
    const base = summary.replace(/\.$/, "");
    const extra = trimmedDescription.endsWith(".")
      ? trimmedDescription
      : `${trimmedDescription}.`;
    summary =
      phrases.length > 1
        ? `${base} It also ${extra.charAt(0).toLowerCase()}${extra.slice(1)}`
        : extra.charAt(0).toUpperCase() + extra.slice(1);
    if (!summary.endsWith(".")) {
      summary += ".";
    }
  } else if (phrases.length === 0 && trimmedDescription.length > 0) {
    summary = trimmedDescription.endsWith(".")
      ? trimmedDescription
      : `${trimmedDescription}.`;
  }

  return {
    title: inferAgentTitle(capabilities, trimmedDescription),
    summary,
  };
}

export function canProceedFromDescribe(description: string): boolean {
  return description.trim().length >= 3;
}

export function canProceedFromCapabilities(
  description: string,
  capabilities: readonly AgentCapabilityId[]
): boolean {
  return capabilities.length > 0 || canProceedFromDescribe(description);
}
