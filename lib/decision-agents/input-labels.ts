export function decisionInputLabel(key: string): string {
  switch (key) {
    case "refund_amount":
      return "Customer refund amount (₹)";
    case "customer_eligible":
      return "Customer eligible";
    case "risk_score":
      return "Risk score (0–1)";
    case "order_age":
      return "Order age (days)";
    case "lead_signals":
      return "Lead signals";
    case "expense_details":
      return "Expense details";
    case "request_context":
      return "Request context";
    default:
      return key.replace(/_/g, " ");
  }
}

export function defaultInputValue(key: string): string {
  switch (key) {
    case "refund_amount":
      return "12000";
    case "customer_eligible":
      return "true";
    case "risk_score":
      return "0.2";
    case "order_age":
      return "5";
    default:
      return "";
  }
}

export function parseInputValue(key: string, raw: string): unknown {
  if (key === "customer_eligible" || key === "policy_match") {
    return raw === "true" || raw === "yes";
  }
  if (key === "refund_amount" || key === "risk_score" || key === "order_age") {
    const num = Number(raw);
    return Number.isFinite(num) ? num : raw;
  }
  return raw;
}
