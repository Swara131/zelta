export const AGENT_TRUST_TOOLTIP =
  "This agent's actions are protected by Wave's policy engine, risk classifier, and audit log";

export const SOC2_COMPLIANCE_HREF = "/settings#trust-compliance";

export const TRUST_FOOTER = {
  tagline: "Enterprise-grade AI agent protection",
  lastAudit: "January 2026",
  status: "All systems operational",
} as const;

export const TRUST_TOAST_EVENT = "zelta:trust-toast";

export const TRUST_TOAST_MESSAGES = {
  protectionConfigured: "✓ Protection configured — Your agents are now guarded",
  connectionConfigured: "✓ Agent connected — Actions now route through Wave",
  testPassed: "✓ Test passed — Your protection pipeline is working",
  rulesSaved: "✓ Protection rules saved — Your agents are now guarded",
} as const;

export type TrustToastMessageKey = keyof typeof TRUST_TOAST_MESSAGES;

export interface TrustToastDetail {
  message: string;
  href?: string;
  linkLabel?: string;
}

export function showTrustToast(message: string | TrustToastDetail): void {
  if (typeof window === "undefined") return;
  const detail = typeof message === "string" ? { message } : message;
  window.dispatchEvent(
    new CustomEvent(TRUST_TOAST_EVENT, { detail })
  );
}

export function showTrustToastByKey(key: TrustToastMessageKey): void {
  showTrustToast(TRUST_TOAST_MESSAGES[key]);
}

export function showSetupCompleteToast(): void {
  showTrustToast({
    message: "✓ Your agent is fully set up and protected. Actions are now gated.",
    href: "/approvals",
    linkLabel: "Go to approvals →",
  });
}
