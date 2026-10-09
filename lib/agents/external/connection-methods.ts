import type { ExternalConnectionMethod } from "./types";

export interface ConnectionMethodOption {
  id: ExternalConnectionMethod;
  label: string;
  description: string;
}

/** Methods the backend can actually test today. MCP is not supported. */
export const SUPPORTED_CONNECTION_METHODS: readonly ConnectionMethodOption[] = [
  {
    id: "rest_api",
    label: "REST API",
    description: "Test an HTTP endpoint your agent exposes.",
  },
  {
    id: "webhook",
    label: "Webhook",
    description: "Send a test payload to your webhook URL.",
  },
  {
    id: "sdk",
    label: "SDK / Wave Gateway",
    description: "Verify your agent can authenticate with the Wave gateway.",
  },
] as const;

export function isSupportedConnectionMethod(value: string): value is ExternalConnectionMethod {
  return value === "rest_api" || value === "webhook" || value === "sdk";
}
