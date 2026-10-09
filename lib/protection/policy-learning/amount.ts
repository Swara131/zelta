export function extractInrMajorFromPayload(payload: Record<string, unknown>): number | null {
  const amount = payload.amount;
  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    return null;
  }

  const currency = String(payload.currency ?? "INR").toUpperCase();
  if (currency === "INR" && amount >= 100) {
    return amount / 100;
  }

  return amount;
}

export function formatInrMajor(amount: number): string {
  const rounded = Math.round(amount);
  return `₹${rounded.toLocaleString("en-IN")}`;
}
