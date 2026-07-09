import type { PolicyEvaluationContext } from "./types";

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function readBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

function inferDestructive(toolName: string, actionType: string): boolean {
  const haystack = `${toolName} ${actionType}`.toLowerCase();
  return (
    haystack.includes("delete") ||
    haystack.includes("destroy") ||
    haystack.includes("drop") ||
    haystack.includes("truncate")
  );
}

function inferProductionTarget(
  environment: string | undefined,
  payload: Record<string, unknown>
): boolean {
  if (environment === "production") {
    return true;
  }
  const explicit = readBoolean(payload.productionTarget);
  if (explicit !== undefined) {
    return explicit;
  }
  const target = readString(payload.target)?.toLowerCase();
  return Boolean(target?.includes("production") || target?.includes("prod"));
}

/** Builds normalized evaluation context from a proposed agent action. */
export function buildPolicyEvaluationContext(input: {
  toolName: string;
  actionType: string;
  payload: Record<string, unknown>;
}): PolicyEvaluationContext {
  const payload = input.payload ?? {};
  const environment = readString(payload.environment)?.toLowerCase();
  const destructiveExplicit = readBoolean(payload.destructiveOperation);

  const dataExportSize =
    readNumber(payload.dataExportSize) ??
    readNumber(payload.recordCount) ??
    readNumber(payload.exportCount) ??
    readNumber(payload.records);

  return {
    toolName: input.toolName.trim(),
    actionType: input.actionType.trim(),
    amount: readNumber(payload.amount),
    currency: readString(payload.currency)?.toUpperCase(),
    environment,
    resourceType: readString(payload.resourceType)?.toLowerCase(),
    destructiveOperation:
      destructiveExplicit ?? inferDestructive(input.toolName, input.actionType),
    productionTarget: inferProductionTarget(environment, payload),
    dataExportSize,
  };
}
