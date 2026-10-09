export interface BuilderTemplatePrompt {
  id: string;
  emoji: string;
  label: string;
  sentence: string;
}

export const BUILDER_TEMPLATE_PROMPTS: readonly BuilderTemplatePrompt[] = [
  {
    id: "refund-processor",
    emoji: "💰",
    label: "Refund processor",
    sentence:
      "Email customers their refund status and issue refunds under ₹5,000",
  },
  {
    id: "email-responder",
    emoji: "📧",
    label: "Email responder",
    sentence: "Send professional responses to customer emails",
  },
  {
    id: "crm-updater",
    emoji: "🤖",
    label: "CRM updater",
    sentence: "Update customer records based on support conversations",
  },
  {
    id: "alert-handler",
    emoji: "🔔",
    label: "Alert handler",
    sentence: "Monitor alerts and notify relevant team members",
  },
] as const;

export const BUILDER_MAX_CHARS = 500;
export const BUILDER_MIN_PARSE_CHARS = 20;
export const BUILDER_GOOD_LENGTH_CHARS = 50;

export const BUILDER_PREVIEW_BULLETS = [
  "Parse your description using AI",
  "Pick safe tools from our library",
  "Auto-generate protection rules",
  "Set up human approval gates",
  "Create an audit log",
] as const;

export const BUILDER_TRUST_BADGES = [
  "No code required",
  "Protection enabled by default",
  "Ready to use in 60 seconds",
] as const;
