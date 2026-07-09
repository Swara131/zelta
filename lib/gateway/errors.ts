export class GatewayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GatewayError";
  }
}

export class AgentAuthError extends GatewayError {
  readonly code: "missing_token" | "invalid_token" | "revoked_token" | "expired_token";

  constructor(
    code: AgentAuthError["code"],
    message = "Agent authentication failed."
  ) {
    super(message);
    this.name = "AgentAuthError";
    this.code = code;
  }
}

export class AgentKeyError extends GatewayError {
  constructor(message: string) {
    super(message);
    this.name = "AgentKeyError";
  }
}

export class ProposalError extends GatewayError {
  readonly code: "agent_mismatch" | "storage_error";

  constructor(message: string, code: ProposalError["code"] = "storage_error") {
    super(message);
    this.name = "ProposalError";
    this.code = code;
  }
}

export class ExecutionTokenError extends GatewayError {
  readonly code:
    | "not_found"
    | "not_eligible"
    | "expired"
    | "replayed"
    | "token_mismatch"
    | "payload_mismatch"
    | "tool_mismatch"
    | "action_type_mismatch"
    | "organization_mismatch"
    | "proposal_mismatch"
    | "concurrent_use";

  constructor(
    message: string,
    code: ExecutionTokenError["code"]
  ) {
    super(message);
    this.name = "ExecutionTokenError";
    this.code = code;
  }
}
