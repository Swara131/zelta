import type { ExternalConnectionMethod } from "./types";

export interface SafetyEligibility {
  eligible: boolean;
  message: string;
}

/**
 * External agents only receive full Wave Safety when actions flow through the gateway (SDK).
 * Outbound REST/webhook tests can verify reachability, not action protection.
 */
export function evaluateExternalSafetyEligibility(
  method: ExternalConnectionMethod
): SafetyEligibility {
  if (method === "sdk") {
    return {
      eligible: true,
      message: "Actions routed through the Wave gateway can be evaluated by Safety policies.",
    };
  }

  return {
    eligible: false,
    message:
      "Safety controls unavailable for this connection type. Route agent actions through the Wave SDK/gateway to enable protection.",
  };
}
