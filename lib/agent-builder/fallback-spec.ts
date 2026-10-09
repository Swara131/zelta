import type { AgentSpec } from "./types";
import { slugifyAgentId } from "./slug";

function includesAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

/** Deterministic fallback when Groq is unavailable — aligned with demo gateway policies. */
export function buildFallbackAgentSpec(description: string): AgentSpec {
  const normalized = description.toLowerCase();

  const mentionsRefund = includesAny(normalized, [
    "refund",
    "₹",
    "inr",
    "money back",
  ]);
  const mentionsEmail = includesAny(normalized, [
    "email",
    "e-mail",
    "mail",
    "message customer",
  ]);

  if (mentionsRefund || mentionsEmail) {
    const name = mentionsRefund ? "Customer Refund Agent" : "Customer Email Agent";
    const tools = [
      ...(mentionsEmail
        ? [
            {
              id: "send_email",
              label: "Send email",
              icon: "📧",
              toolName: "send_email",
              actionType: "communication.email",
            },
          ]
        : []),
      ...(mentionsRefund
        ? [
            {
              id: "issue_refund",
              label: "Issue refund",
              icon: "💳",
              toolName: "issue_refund",
              actionType: "financial.refund",
            },
          ]
        : []),
    ];

    const protection = [
      {
        level: "allow" as const,
        label: "Check refund status",
        description: "Looking up refund status is always safe.",
      },
      ...(mentionsEmail
        ? [
            {
              level: "allow" as const,
              label: "Send customer email",
              description: "Routine customer emails can go out automatically.",
            },
          ]
        : []),
      ...(mentionsRefund
        ? [
            {
              level: "allow" as const,
              label: "Refund up to ₹5,000",
              description: "Small refunds can happen automatically.",
            },
            {
              level: "review" as const,
              label: "Refund above ₹5,000",
              description: "You approve larger refunds before they go through.",
            },
            {
              level: "review" as const,
              label: "Give large discounts",
              description: "Big discounts pause for your approval.",
            },
          ]
        : []),
      {
        level: "block" as const,
        label: "Delete customer records",
        description: "Customer data cannot be deleted by the agent.",
      },
      {
        level: "block" as const,
        label: "Transfer money without authorization",
        description: "Unauthorized transfers are never allowed.",
      },
    ];

    const summaryParts: string[] = [];
    if (mentionsEmail) {
      summaryParts.push("Emails customers about refunds");
    }
    if (mentionsRefund) {
      summaryParts.push("processes refunds under ₹5,000");
    }

    return {
      name,
      agentId: slugifyAgentId(name),
      summary:
        summaryParts.length > 0
          ? `${summaryParts[0]!}${summaryParts.length > 1 ? ` and ${summaryParts.slice(1).join(" and ")}` : ""}.`
          : description.trim(),
      purpose: description.trim(),
      tools:
        tools.length > 0
          ? tools
          : [
              {
                id: "custom_action",
                label: "Custom action",
                icon: "🤖",
                toolName: "custom_action",
                actionType: "custom.action",
              },
            ],
      protection,
      generatedAt: new Date().toISOString(),
      source: "fallback",
    };
  }

  const name = "Custom AI Agent";
  return {
    name,
    agentId: slugifyAgentId(name),
    summary: description.trim() || "Performs tasks you described.",
    purpose: description.trim(),
    tools: [
      {
        id: "custom_action",
        label: "Custom action",
        icon: "🤖",
        toolName: "custom_action",
        actionType: "custom.action",
      },
    ],
    protection: [
      {
        level: "review",
        label: "Important actions",
        description: "Risky actions pause for your approval before they run.",
      },
      {
        level: "block",
        label: "Dangerous actions",
        description: "Harmful actions are blocked automatically.",
      },
    ],
    generatedAt: new Date().toISOString(),
    source: "fallback",
  };
}
