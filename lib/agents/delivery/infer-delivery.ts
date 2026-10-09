import type { AgentDeliveryMode } from "./types";

export function inferDeliveryModeFromText(text: string): AgentDeliveryMode {
  const normalized = text.toLowerCase();

  const wantsEmail =
    /\b(email me|send me an email|send an email|mail me|deliver.*email|to my inbox|in my inbox|by email|on email|via email|email (the )?(report|summary|digest))\b/.test(
      normalized
    );
  const wantsNotification = /\b(notify me|notification|alert me|in zelta|zelta notification)\b/.test(
    normalized
  );

  if (wantsEmail && wantsNotification) return "both";
  if (wantsEmail) return "email";
  if (wantsNotification) return "notification";

  return "notification";
}

export function deliveryModeLabel(mode: AgentDeliveryMode): string {
  switch (mode) {
    case "email":
      return "Email";
    case "whatsapp":
      return "WhatsApp";
    case "notification":
      return "Wave notification";
    case "both":
      return "Email and WhatsApp";
    default:
      return "None";
  }
}
