export class BillingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BillingError";
  }
}

export class PlanRequiredError extends BillingError {
  readonly requiredPlan: string;
  readonly currentPlan: string;

  constructor(requiredPlan: string, currentPlan: string) {
    super(`This feature requires the ${requiredPlan} plan or higher.`);
    this.name = "PlanRequiredError";
    this.requiredPlan = requiredPlan;
    this.currentPlan = currentPlan;
  }
}

export class UsageLimitError extends BillingError {
  readonly metric: string;

  constructor(metric: string) {
    super(`Usage limit reached for ${metric}. Upgrade your plan to continue.`);
    this.name = "UsageLimitError";
    this.metric = metric;
  }
}
