/** When true, authenticated users receive Enterprise-level feature access without DB/Stripe changes. */
export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === "true";
}
