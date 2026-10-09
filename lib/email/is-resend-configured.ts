import { getResendConfigStatus } from "./resend-config";

export function isResendConfigured(): boolean {
  return getResendConfigStatus().configured;
}
