import { buildPolicyEvaluationContext } from "@/lib/gateway/policy/context";
import type { ShadowRiskSignalSeverity } from "./assessment";

/** Explicit availability — never invent missing values. */
export type RiskFieldStatus = "known" | "unknown";

export type KnownRiskField<T> = { status: "known"; value: T };
export type UnknownRiskField = { status: "unknown" };
export type RiskField<T> = KnownRiskField<T> | UnknownRiskField;

export const UNKNOWN_RISK_FIELD: UnknownRiskField = { status: "unknown" };

export function knownRiskField<T>(value: T): KnownRiskField<T> {
  return { status: "known", value };
}

export type Reversibility = "reversible" | "irreversible";

/** Normalized deterministic view of a proposed action for risk analysis. */
export interface RiskContext {
  agentId: string;
  toolName: string;
  actionType: string;
  monetaryAmount: RiskField<number>;
  currency: RiskField<string>;
  reversibility: RiskField<Reversibility>;
  destructiveOperation: RiskField<boolean>;
  productionTarget: RiskField<boolean>;
  externalDestination: RiskField<boolean>;
  newOrUnknownDestination: RiskField<boolean>;
  bulkOperation: RiskField<boolean>;
  sensitiveDataExposure: RiskField<boolean>;
  privilegeChange: RiskField<boolean>;
  credentialRelatedAction: RiskField<boolean>;
  unusualActionCategory: RiskField<boolean>;
  environment: RiskField<string>;
  resourceType: RiskField<string>;
  dataExportSize: RiskField<number>;
  integratorMetadata: RiskField<Record<string, unknown>>;
}

export interface DeterministicRiskSignal {
  code: string;
  description: string;
  severity: ShadowRiskSignalSeverity;
  source: "deterministic";
}

const FORBIDDEN_METADATA_KEY =
  /^(authorization|cookie|apikey|api_key|executiontoken|execution_token|token|secret|password|service_role|service_role_key|key_hash|token_hash|plainkey|plain_key|resend_api_key)$/i;

const SECRET_VALUE_PATTERN = /^(et_|al_)[a-z0-9_+-]+$/i;

const BULK_RECORD_THRESHOLD = 100;

const STANDARD_ACTION_CATEGORY_PREFIXES = [
  "financial.",
  "database.",
  "data.",
  "communication.",
  "identity.",
  "storage.",
  "integration.",
];

const REVERSIBLE_ACTION_HINTS = [
  "refund",
  "reversal",
  "undo",
  "rollback",
  "restore",
  "cancel",
  "void",
];

const IRREVERSIBLE_ACTION_HINTS = [
  "delete",
  "destroy",
  "drop",
  "truncate",
  "purge",
  "wipe",
];

const SENSITIVE_ACTION_HINTS = [
  "export",
  "pii",
  "personal",
  "ssn",
  "credential",
  "secret",
  "password",
];

const PRIVILEGE_ACTION_HINTS = [
  "role",
  "permission",
  "privilege",
  "admin",
  "grant",
  "elevate",
  "iam",
  "access_control",
];

const CREDENTIAL_ACTION_HINTS = [
  "password",
  "credential",
  "api_key",
  "apikey",
  "secret",
  "token_rotate",
  "rotate_key",
  "reset_password",
];

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

function haystackIncludes(haystack: string, hints: string[]): boolean {
  const normalized = haystack.toLowerCase();
  return hints.some((hint) => normalized.includes(hint));
}

function inferDestructiveFromNames(toolName: string, actionType: string): boolean {
  return haystackIncludes(`${toolName} ${actionType}`, IRREVERSIBLE_ACTION_HINTS);
}

function readProductionTarget(
  payload: Record<string, unknown>,
  environment: string | undefined
): RiskField<boolean> {
  const explicit = readBoolean(payload.productionTarget);
  if (explicit !== undefined) {
    return knownRiskField(explicit);
  }
  if (environment === "production") {
    return knownRiskField(true);
  }
  const target = readString(payload.target)?.toLowerCase();
  if (target?.includes("production") || target?.includes("prod")) {
    return knownRiskField(true);
  }
  if (environment !== undefined || readString(payload.target) !== undefined) {
    return knownRiskField(false);
  }
  return UNKNOWN_RISK_FIELD;
}

function readDestructiveOperation(
  payload: Record<string, unknown>,
  toolName: string,
  actionType: string
): RiskField<boolean> {
  const explicit = readBoolean(payload.destructiveOperation);
  if (explicit !== undefined) {
    return knownRiskField(explicit);
  }
  if (inferDestructiveFromNames(toolName, actionType)) {
    return knownRiskField(true);
  }
  if (readBoolean(payload.destructiveOperation) === false) {
    return knownRiskField(false);
  }
  return UNKNOWN_RISK_FIELD;
}

function readReversibility(
  payload: Record<string, unknown>,
  toolName: string,
  actionType: string,
  destructive: RiskField<boolean>
): RiskField<Reversibility> {
  const explicitString = readString(payload.reversibility)?.toLowerCase();
  if (explicitString === "reversible" || explicitString === "irreversible") {
    return knownRiskField(explicitString);
  }
  const explicitBoolean = readBoolean(payload.reversible);
  if (explicitBoolean === true) {
    return knownRiskField("reversible");
  }
  if (explicitBoolean === false) {
    return knownRiskField("irreversible");
  }
  if (destructive.status === "known" && destructive.value) {
    return knownRiskField("irreversible");
  }
  const haystack = `${toolName} ${actionType}`;
  if (haystackIncludes(haystack, REVERSIBLE_ACTION_HINTS)) {
    return knownRiskField("reversible");
  }
  if (haystackIncludes(haystack, IRREVERSIBLE_ACTION_HINTS)) {
    return knownRiskField("irreversible");
  }
  return UNKNOWN_RISK_FIELD;
}

function readExternalDestination(payload: Record<string, unknown>): RiskField<boolean> {
  for (const key of ["externalDestination", "isExternal"]) {
    const value = readBoolean(payload[key]);
    if (value !== undefined) {
      return knownRiskField(value);
    }
  }
  const destinationType = readString(payload.destinationType)?.toLowerCase();
  if (destinationType === "external") {
    return knownRiskField(true);
  }
  if (destinationType === "internal") {
    return knownRiskField(false);
  }
  return UNKNOWN_RISK_FIELD;
}

function readNewOrUnknownDestination(payload: Record<string, unknown>): RiskField<boolean> {
  for (const key of ["isNewDestination", "newDestination", "unknownDestination"]) {
    const value = readBoolean(payload[key]);
    if (value !== undefined) {
      return knownRiskField(value);
    }
  }
  const firstTime = readBoolean(payload.firstTimeDestination);
  if (firstTime === true) {
    return knownRiskField(true);
  }
  if (firstTime === false) {
    return knownRiskField(false);
  }
  return UNKNOWN_RISK_FIELD;
}

function readBulkOperation(payload: Record<string, unknown>): RiskField<boolean> {
  const explicit = readBoolean(payload.bulkOperation);
  if (explicit !== undefined) {
    return knownRiskField(explicit);
  }
  const size =
    readNumber(payload.dataExportSize) ??
    readNumber(payload.recordCount) ??
    readNumber(payload.exportCount) ??
    readNumber(payload.records) ??
    readNumber(payload.batchSize);
  if (size !== undefined) {
    return knownRiskField(size >= BULK_RECORD_THRESHOLD);
  }
  return UNKNOWN_RISK_FIELD;
}

function readSensitiveDataExposure(
  payload: Record<string, unknown>,
  toolName: string,
  actionType: string
): RiskField<boolean> {
  for (const key of ["sensitiveDataExposure", "containsPii", "includesPersonalData"]) {
    const value = readBoolean(payload[key]);
    if (value !== undefined) {
      return knownRiskField(value);
    }
  }
  if (haystackIncludes(`${toolName} ${actionType}`, SENSITIVE_ACTION_HINTS)) {
    return knownRiskField(true);
  }
  return UNKNOWN_RISK_FIELD;
}

function readPrivilegeChange(
  payload: Record<string, unknown>,
  toolName: string,
  actionType: string
): RiskField<boolean> {
  const explicit = readBoolean(payload.privilegeChange);
  if (explicit !== undefined) {
    return knownRiskField(explicit);
  }
  if (haystackIncludes(`${toolName} ${actionType}`, PRIVILEGE_ACTION_HINTS)) {
    return knownRiskField(true);
  }
  return UNKNOWN_RISK_FIELD;
}

function readCredentialRelatedAction(
  payload: Record<string, unknown>,
  toolName: string,
  actionType: string
): RiskField<boolean> {
  const explicit = readBoolean(payload.credentialRelatedAction);
  if (explicit !== undefined) {
    return knownRiskField(explicit);
  }
  if (haystackIncludes(`${toolName} ${actionType}`, CREDENTIAL_ACTION_HINTS)) {
    return knownRiskField(true);
  }
  return UNKNOWN_RISK_FIELD;
}

function readUnusualActionCategory(actionType: string): RiskField<boolean> {
  const explicit = readString(actionType);
  if (!explicit) {
    return UNKNOWN_RISK_FIELD;
  }
  const normalized = explicit.toLowerCase();
  const isStandard = STANDARD_ACTION_CATEGORY_PREFIXES.some((prefix) =>
    normalized.startsWith(prefix)
  );
  return knownRiskField(!isStandard);
}

function sanitizeIntegratorValue(value: unknown, key = ""): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (FORBIDDEN_METADATA_KEY.test(key)) {
      return "[redacted]";
    }
    if (SECRET_VALUE_PATTERN.test(trimmed) && trimmed.length > 16) {
      return "[redacted]";
    }
    return trimmed;
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => sanitizeIntegratorValue(item, `${key}[${index}]`));
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const sanitized: Record<string, unknown> = {};
    for (const [entryKey, entryValue] of Object.entries(record)) {
      if (FORBIDDEN_METADATA_KEY.test(entryKey)) {
        sanitized[entryKey] = "[redacted]";
        continue;
      }
      sanitized[entryKey] = sanitizeIntegratorValue(entryValue, entryKey);
    }
    return sanitized;
  }
  return value;
}

function readIntegratorMetadata(payload: Record<string, unknown>): RiskField<Record<string, unknown>> {
  const raw =
    (typeof payload.riskMetadata === "object" && payload.riskMetadata !== null
      ? payload.riskMetadata
      : undefined) ??
    (typeof payload.metadata === "object" && payload.metadata !== null
      ? payload.metadata
      : undefined);

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return UNKNOWN_RISK_FIELD;
  }

  return knownRiskField(
    sanitizeIntegratorValue(raw) as Record<string, unknown>
  );
}

/** Builds a typed risk context from a proposed action without mutating input. */
export function buildRiskContext(input: {
  agentId: string;
  toolName: string;
  actionType: string;
  payload: Record<string, unknown>;
}): RiskContext {
  const payload = input.payload ?? {};
  const policyContext = buildPolicyEvaluationContext({
    toolName: input.toolName,
    actionType: input.actionType,
    payload,
  });

  const environment =
    policyContext.environment !== undefined
      ? knownRiskField(policyContext.environment)
      : UNKNOWN_RISK_FIELD;
  const destructiveOperation = readDestructiveOperation(
    payload,
    input.toolName,
    input.actionType
  );

  return {
    agentId: input.agentId.trim(),
    toolName: input.toolName.trim(),
    actionType: input.actionType.trim(),
    monetaryAmount:
      policyContext.amount !== undefined
        ? knownRiskField(policyContext.amount)
        : UNKNOWN_RISK_FIELD,
    currency:
      policyContext.currency !== undefined
        ? knownRiskField(policyContext.currency)
        : UNKNOWN_RISK_FIELD,
    reversibility: readReversibility(
      payload,
      input.toolName,
      input.actionType,
      destructiveOperation
    ),
    destructiveOperation,
    productionTarget: readProductionTarget(payload, policyContext.environment),
    externalDestination: readExternalDestination(payload),
    newOrUnknownDestination: readNewOrUnknownDestination(payload),
    bulkOperation: readBulkOperation(payload),
    sensitiveDataExposure: readSensitiveDataExposure(
      payload,
      input.toolName,
      input.actionType
    ),
    privilegeChange: readPrivilegeChange(payload, input.toolName, input.actionType),
    credentialRelatedAction: readCredentialRelatedAction(
      payload,
      input.toolName,
      input.actionType
    ),
    unusualActionCategory: readUnusualActionCategory(input.actionType),
    environment,
    resourceType:
      policyContext.resourceType !== undefined
        ? knownRiskField(policyContext.resourceType)
        : UNKNOWN_RISK_FIELD,
    dataExportSize:
      policyContext.dataExportSize !== undefined
        ? knownRiskField(policyContext.dataExportSize)
        : UNKNOWN_RISK_FIELD,
    integratorMetadata: readIntegratorMetadata(payload),
  };
}

function booleanSignal(
  field: RiskField<boolean>,
  codeWhenTrue: string,
  codeWhenFalse: string,
  codeWhenUnknown: string,
  descriptionWhenTrue: string,
  descriptionWhenFalse: string,
  severityWhenTrue: ShadowRiskSignalSeverity,
  severityWhenFalse: ShadowRiskSignalSeverity = "low"
): DeterministicRiskSignal {
  if (field.status === "unknown") {
    return {
      code: codeWhenUnknown,
      description: "Information unavailable in action payload.",
      severity: "low",
      source: "deterministic",
    };
  }
  if (field.value) {
    return {
      code: codeWhenTrue,
      description: descriptionWhenTrue,
      severity: severityWhenTrue,
      source: "deterministic",
    };
  }
  return {
    code: codeWhenFalse,
    description: descriptionWhenFalse,
    severity: severityWhenFalse,
    source: "deterministic",
  };
}

/** Derives stable signal codes from a risk context for audit and analytics. */
export function extractDeterministicRiskSignals(context: RiskContext): DeterministicRiskSignal[] {
  const signals: DeterministicRiskSignal[] = [
    {
      code: "agent.identity",
      description: `Agent ${context.agentId}`,
      severity: "low",
      source: "deterministic",
    },
    {
      code: `action.type.${context.actionType.replace(/[^a-zA-Z0-9._-]+/g, "_")}`,
      description: `Action type ${context.actionType}`,
      severity: "low",
      source: "deterministic",
    },
    {
      code: `tool.name.${context.toolName.replace(/[^a-zA-Z0-9._-]+/g, "_")}`,
      description: `Tool ${context.toolName}`,
      severity: "low",
      source: "deterministic",
    },
  ];

  if (context.monetaryAmount.status === "known") {
    signals.push({
      code: "financial.amount.present",
      description: `Monetary amount ${context.monetaryAmount.value}`,
      severity: context.monetaryAmount.value >= 500_001 ? "high" : "medium",
      source: "deterministic",
    });
  } else {
    signals.push({
      code: "financial.amount.unknown",
      description: "Monetary amount not provided.",
      severity: "low",
      source: "deterministic",
    });
  }

  if (context.currency.status === "known") {
    signals.push({
      code: `financial.currency.${context.currency.value.toLowerCase()}`,
      description: `Currency ${context.currency.value}`,
      severity: "low",
      source: "deterministic",
    });
  } else {
    signals.push({
      code: "financial.currency.unknown",
      description: "Currency not provided.",
      severity: "low",
      source: "deterministic",
    });
  }

  if (context.reversibility.status === "known") {
    signals.push({
      code: `operation.${context.reversibility.value}`,
      description:
        context.reversibility.value === "reversible"
          ? "Action appears reversible."
          : "Action appears irreversible.",
      severity: context.reversibility.value === "irreversible" ? "high" : "low",
      source: "deterministic",
    });
  } else {
    signals.push({
      code: "operation.reversibility.unknown",
      description: "Reversibility not provided.",
      severity: "low",
      source: "deterministic",
    });
  }

  signals.push(
    booleanSignal(
      context.destructiveOperation,
      "operation.destructive",
      "operation.non_destructive",
      "operation.destructive.unknown",
      "Destructive operation indicated.",
      "Non-destructive operation.",
      "high"
    ),
    booleanSignal(
      context.productionTarget,
      "environment.production",
      "environment.non_production",
      "environment.production.unknown",
      "Production environment target indicated.",
      "Non-production environment target.",
      "high"
    ),
    booleanSignal(
      context.externalDestination,
      "destination.external",
      "destination.internal",
      "destination.external.unknown",
      "External destination indicated.",
      "Internal destination indicated.",
      "medium"
    ),
    booleanSignal(
      context.newOrUnknownDestination,
      "destination.new_or_unknown",
      "destination.known",
      "destination.new_or_unknown.unknown",
      "New or unknown destination indicated.",
      "Known destination indicated.",
      "medium"
    ),
    booleanSignal(
      context.bulkOperation,
      "operation.bulk",
      "operation.single",
      "operation.bulk.unknown",
      "Bulk operation indicated.",
      "Single-item operation.",
      "medium"
    ),
    booleanSignal(
      context.sensitiveDataExposure,
      "data.sensitive_exposure",
      "data.no_sensitive_exposure",
      "data.sensitive_exposure.unknown",
      "Sensitive data exposure indicated.",
      "No sensitive data exposure indicated.",
      "high"
    ),
    booleanSignal(
      context.privilegeChange,
      "privilege.change",
      "privilege.no_change",
      "privilege.change.unknown",
      "Privilege change indicated.",
      "No privilege change indicated.",
      "high"
    ),
    booleanSignal(
      context.credentialRelatedAction,
      "credential.related",
      "credential.not_related",
      "credential.related.unknown",
      "Credential-related action indicated.",
      "Not credential-related.",
      "high"
    ),
    booleanSignal(
      context.unusualActionCategory,
      "action.category.unusual",
      "action.category.standard",
      "action.category.unknown",
      "Action category outside standard prefixes.",
      "Action category matches a standard prefix.",
      "medium"
    )
  );

  if (context.environment.status === "known") {
    signals.push({
      code: `environment.name.${context.environment.value}`,
      description: `Environment ${context.environment.value}`,
      severity: context.environment.value === "production" ? "high" : "low",
      source: "deterministic",
    });
  }

  if (context.resourceType.status === "known") {
    signals.push({
      code: `resource.type.${context.resourceType.value}`,
      description: `Resource type ${context.resourceType.value}`,
      severity: "low",
      source: "deterministic",
    });
  }

  if (context.dataExportSize.status === "known") {
    signals.push({
      code: "data.export_size.present",
      description: `Export size ${context.dataExportSize.value}`,
      severity: context.dataExportSize.value >= BULK_RECORD_THRESHOLD ? "medium" : "low",
      source: "deterministic",
    });
  }

  if (context.integratorMetadata.status === "known") {
    signals.push({
      code: "integrator.metadata.present",
      description: "Integrator supplied risk metadata.",
      severity: "low",
      source: "deterministic",
    });
  }

  return signals;
}

/** JSON-safe risk context for classifier prompts and storage (secrets redacted). */
export function sanitizeRiskContextForClassifier(context: RiskContext): Record<string, unknown> {
  return {
    agentId: context.agentId,
    toolName: context.toolName,
    actionType: context.actionType,
    monetaryAmount: context.monetaryAmount,
    currency: context.currency,
    reversibility: context.reversibility,
    destructiveOperation: context.destructiveOperation,
    productionTarget: context.productionTarget,
    externalDestination: context.externalDestination,
    newOrUnknownDestination: context.newOrUnknownDestination,
    bulkOperation: context.bulkOperation,
    sensitiveDataExposure: context.sensitiveDataExposure,
    privilegeChange: context.privilegeChange,
    credentialRelatedAction: context.credentialRelatedAction,
    unusualActionCategory: context.unusualActionCategory,
    environment: context.environment,
    resourceType: context.resourceType,
    dataExportSize: context.dataExportSize,
    integratorMetadata: context.integratorMetadata,
  };
}
