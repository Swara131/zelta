/** Predictable client-side error codes for external agent integrations. */
export type GatewayClientErrorCode =
  | "network_error"
  | "invalid_response"
  | "validation_error"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "rate_limit"
  | "server_error"
  | "poll_timeout"
  | "proposal_rejected"
  | "proposal_blocked"
  | "proposal_expired"
  | "token_unavailable";

export class GatewayClientError extends Error {
  readonly code: GatewayClientErrorCode;
  readonly status: number;
  readonly apiCode?: string;
  readonly details?: unknown;

  constructor(params: {
    code: GatewayClientErrorCode;
    message: string;
    status: number;
    apiCode?: string;
    details?: unknown;
  }) {
    super(params.message);
    this.name = "GatewayClientError";
    this.code = params.code;
    this.status = params.status;
    this.apiCode = params.apiCode;
    this.details = params.details;
  }
}

export function mapHttpStatusToClientCode(status: number): GatewayClientErrorCode {
  if (status === 400) return "validation_error";
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 429) return "rate_limit";
  if (status >= 500) return "server_error";
  return "invalid_response";
}
