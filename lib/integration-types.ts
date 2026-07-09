export type IntegrationStatus = "connected" | "disconnected" | "pending" | "error";

export type IntegrationCategory = "identity" | "collaboration" | "devops" | "cloud" | "siem";

export interface Integration {
  id: string;
  name: string;
  description: string;
  category: IntegrationCategory;
  status: IntegrationStatus;
  logoKey: string;
  brandColor: string;
  connectedAt?: string;
  lastSync?: string;
}

export type IntegrationFilter = "all" | IntegrationCategory;
