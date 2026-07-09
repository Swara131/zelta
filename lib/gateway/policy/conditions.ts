import type { PolicyConditions, PolicyEvaluationContext } from "./types";

function matchesStringField(
  actual: string | undefined,
  expected: string | string[] | undefined
): boolean {
  if (expected === undefined) {
    return true;
  }

  if (actual === undefined) {
    return false;
  }

  const allowed = Array.isArray(expected) ? expected : [expected];
  return allowed.some((value) => actual === value || actual === value.toLowerCase());
}

function matchesCurrency(
  actual: string | undefined,
  expected: string | undefined
): boolean {
  if (expected === undefined) {
    return true;
  }
  return actual?.toUpperCase() === expected.toUpperCase();
}

function matchesAmount(
  amount: number | undefined,
  min?: number,
  max?: number
): boolean {
  if (min === undefined && max === undefined) {
    return true;
  }
  if (amount === undefined) {
    return false;
  }
  if (min !== undefined && amount < min) {
    return false;
  }
  if (max !== undefined && amount > max) {
    return false;
  }
  return true;
}

function matchesBooleanField(
  actual: boolean,
  expected: boolean | undefined
): boolean {
  if (expected === undefined) {
    return true;
  }
  return actual === expected;
}

function matchesExportSize(
  size: number | undefined,
  min?: number,
  max?: number
): boolean {
  if (min === undefined && max === undefined) {
    return true;
  }
  if (size === undefined) {
    return false;
  }
  if (min !== undefined && size < min) {
    return false;
  }
  if (max !== undefined && size > max) {
    return false;
  }
  return true;
}

/** Returns true when every specified condition field matches the action context. */
export function conditionsMatch(
  context: PolicyEvaluationContext,
  conditions: PolicyConditions
): boolean {
  if (!matchesStringField(context.toolName, conditions.toolName)) {
    return false;
  }

  if (!matchesStringField(context.actionType, conditions.actionType)) {
    return false;
  }

  if (!matchesAmount(context.amount, conditions.amountMin, conditions.amountMax)) {
    return false;
  }

  if (!matchesCurrency(context.currency, conditions.currency)) {
    return false;
  }

  if (!matchesStringField(context.environment, conditions.environment)) {
    return false;
  }

  if (!matchesStringField(context.resourceType, conditions.resourceType)) {
    return false;
  }

  if (!matchesBooleanField(context.destructiveOperation, conditions.destructiveOperation)) {
    return false;
  }

  if (!matchesBooleanField(context.productionTarget, conditions.productionTarget)) {
    return false;
  }

  if (
    !matchesExportSize(
      context.dataExportSize,
      conditions.dataExportSizeMin,
      conditions.dataExportSizeMax
    )
  ) {
    return false;
  }

  return true;
}
