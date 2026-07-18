import {
  GatewayClientError,
  mapHttpStatusToClientCode,
  type GatewayClientErrorCode,
} from "./client-errors";
import type { ProposeActionInput, ProposeActionResponse } from "./proposals/types";
import type {
  ProposalStatusResponse,
  VerifyExecutionInput,
  VerifyExecutionResult,
} from "./tokens/types";

export type { ProposeActionInput, ProposeActionResponse } from "./proposals/types";
export type {
  ProposalStatusResponse,
  VerifyExecutionInput,
  VerifyExecutionResult,
} from "./tokens/types";
export { GatewayClientError, type GatewayClientErrorCode } from "./client-errors";

const DEFAULT_POLL_INTERVAL_MS = 5_000;
const DEFAULT_POLL_TIMEOUT_MS = 300_000;

export interface ApprovalLayerClientConfig {
  /** Gateway base URL, e.g. https://app.example.com or http://localhost:3000 */
  baseUrl: string;
  /** Plaintext agent API key (al_...) */
  apiKey: string;
  /** Delay between status polls. Default: 5000ms */
  pollIntervalMs?: number;
  /** Max wait during pollUntilResolved. Default: 300000ms (5 min) */
  pollTimeoutMs?: number;
  /** Injectable fetch for tests. Default: global fetch */
  fetchImpl?: typeof fetch;
  /** Injectable sleep for tests. Default: setTimeout-based delay */
  sleep?: (ms: number) => Promise<void>;
}

export interface PollUntilResolvedOptions {
  pollIntervalMs?: number;
  pollTimeoutMs?: number;
}

export interface PollUntilResolvedResult extends ProposalStatusResponse {
  /** Present when the proposal is approved and a fresh execution token was issued. */
  executionToken: string;
}

interface ApiErrorBody {
  error?: string;
  code?: string;
  details?: unknown;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isTerminalFailureStatus(
  status: ProposalStatusResponse["status"]
): status is "rejected" | "blocked" | "expired" {
  return status === "rejected" || status === "blocked" || status === "expired";
}

function terminalFailureCode(
  status: "rejected" | "blocked" | "expired"
): GatewayClientErrorCode {
  switch (status) {
    case "rejected":
      return "proposal_rejected";
    case "blocked":
      return "proposal_blocked";
    case "expired":
      return "proposal_expired";
  }
}

export class ApprovalLayerAgentClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly pollIntervalMs: number;
  private readonly pollTimeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(config: ApprovalLayerClientConfig) {
    const apiKey = config.apiKey.trim();
    if (!apiKey) {
      throw new GatewayClientError({
        code: "validation_error",
        message: "apiKey is required.",
        status: 0,
      });
    }

    this.baseUrl = normalizeBaseUrl(config.baseUrl.trim());
    if (!this.baseUrl) {
      throw new GatewayClientError({
        code: "validation_error",
        message: "baseUrl is required.",
        status: 0,
      });
    }

    this.apiKey = apiKey;
    this.pollIntervalMs = config.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    this.pollTimeoutMs = config.pollTimeoutMs ?? DEFAULT_POLL_TIMEOUT_MS;
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.sleep = config.sleep ?? defaultSleep;
  }

  async propose(action: ProposeActionInput): Promise<ProposeActionResponse> {
    return this.request<ProposeActionResponse>("POST", "/api/v1/actions/propose", {
      body: action,
      expectedStatus: 201,
    });
  }

  async getStatus(proposalId: string): Promise<ProposalStatusResponse> {
    return this.request<ProposalStatusResponse>(
      "GET",
      `/api/v1/actions/${encodeURIComponent(proposalId)}/status`
    );
  }

  /**
   * Polls GET /status until an execution token is issued or the proposal reaches
   * a terminal state (rejected, blocked, expired).
   */
  async pollUntilResolved(
    proposalId: string,
    options: PollUntilResolvedOptions = {}
  ): Promise<PollUntilResolvedResult> {
    const intervalMs = options.pollIntervalMs ?? this.pollIntervalMs;
    const timeoutMs = options.pollTimeoutMs ?? this.pollTimeoutMs;
    const deadline = Date.now() + timeoutMs;

    while (Date.now() <= deadline) {
      const status = await this.getStatus(proposalId);

      if (status.executionToken) {
        return {
          ...status,
          executionToken: status.executionToken,
        };
      }

      if (isTerminalFailureStatus(status.status)) {
        throw new GatewayClientError({
          code: terminalFailureCode(status.status),
          message: `Proposal ${proposalId} ended with status=${status.status}.`,
          status: 200,
        });
      }

      if (
        status.status === "approved" &&
        status.executionTokenIssued &&
        !status.executionToken
      ) {
        throw new GatewayClientError({
          code: "token_unavailable",
          message:
            "Proposal is approved but no execution token is available (likely already consumed).",
          status: 200,
        });
      }

      if (Date.now() + intervalMs > deadline) {
        break;
      }

      await this.sleep(intervalMs);
    }

    throw new GatewayClientError({
      code: "poll_timeout",
      message: `Timed out after ${timeoutMs}ms waiting for proposal ${proposalId} to resolve.`,
      status: 0,
    });
  }

  async verifyExecution(
    proposalId: string,
    input: VerifyExecutionInput
  ): Promise<VerifyExecutionResult> {
    return this.request<VerifyExecutionResult>(
      "POST",
      `/api/v1/actions/${encodeURIComponent(proposalId)}/verify-execution`,
      { body: input }
    );
  }

  private async request<T>(
    method: "GET" | "POST",
    path: string,
    options: { body?: unknown; expectedStatus?: number } = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    let response: Response;

    try {
      response = await this.fetchImpl(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Network request failed.";
      throw new GatewayClientError({
        code: "network_error",
        message,
        status: 0,
      });
    }

    const text = await response.text();
    let body: unknown = {};

    if (text) {
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        throw new GatewayClientError({
          code: "invalid_response",
          message: `Non-JSON response from ${path}.`,
          status: response.status,
        });
      }
    }

    const expectedStatus = options.expectedStatus ?? 200;
    if (response.status !== expectedStatus) {
      throw this.toClientError(response.status, body, path);
    }

    return body as T;
  }

  private toClientError(status: number, body: unknown, path: string): GatewayClientError {
    const payload = (typeof body === "object" && body !== null ? body : {}) as ApiErrorBody;
    const message =
      typeof payload.error === "string"
        ? payload.error
        : `Request to ${path} failed with status ${status}.`;

    return new GatewayClientError({
      code: mapHttpStatusToClientCode(status),
      message,
      status,
      apiCode: typeof payload.code === "string" ? payload.code : undefined,
      details: payload.details,
    });
  }
}
