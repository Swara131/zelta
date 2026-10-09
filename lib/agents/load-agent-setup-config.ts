import type { AgentApiKeyRecord } from "@/lib/gateway/types";
import type { AgentSpec } from "@/lib/agent-builder/types";
import type { AgentCapabilityId } from "@/lib/agent-builder/wizard-options";
import { AGENT_CAPABILITY_OPTIONS } from "@/lib/agent-builder/wizard-options";
import { loadAgentProtectionSettings } from "@/lib/agent-builder/agent-protection-settings";
import {
  getAgentCardLifecycleView,
  loadAgentLifecycle,
  saveAgentLifecycle,
} from "@/lib/agent-builder/agent-lifecycle";
import { loadCreatedAgentSession } from "@/lib/agent-builder/created-agent-session";
import {
  loadAgentConfigCache,
  saveAgentConfigCache,
  type StoredAgentConfig,
} from "@/lib/agents/agent-config-storage";
import { labelAgentTools, labelTriggerType } from "@/lib/agents/tool-labels";
import { humanizeAgentLabel, describeAgentPurpose } from "@/lib/dashboard/founder-copy";
import { parseTemplateFromAgentSource } from "@/lib/templates/parse-template-source";

export interface AgentActionItem {
  id: string;
  label: string;
  source: "tool" | "capability";
}

export interface AgentSetupConfig {
  agentId: string;
  name: string;
  description: string;
  purpose: string;
  agentType: string;
  triggerLabel: string;
  actions: AgentActionItem[];
  hasActions: boolean;
  protection: {
    thresholdInr: number | null;
    autoAllowLowRisk: boolean;
  };
  connection: {
    label: string;
    keyPrefix: string | null;
    connected: boolean;
  };
  statusLabel: string;
  isLive: boolean;
  createdAt: string;
  templateName?: string;
  templateId?: string;
  templateSlug?: string;
  dataSource: "database" | "cache" | "session" | "fallback";
}

interface ApiAgentResponse {
  agent: {
    slug: string;
    name: string;
    description: string;
    source: string;
    tools: string[];
    triggerType: string;
    suggestedThreshold: number | null;
    status: string;
    createdAt: string;
  };
  policy: {
    threshold: number | null;
    autoAllow: boolean;
  } | null;
}

function formatCreatedAt(iso: string | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function capabilityLabels(capabilities: AgentCapabilityId[]): AgentActionItem[] {
  return capabilities.map((id) => {
    const option = AGENT_CAPABILITY_OPTIONS.find((item) => item.id === id);
    return {
      id,
      label: option?.label ?? id,
      source: "capability" as const,
    };
  });
}

function toolActionItems(tools: string[]): AgentActionItem[] {
  return labelAgentTools(tools).map((tool) => ({
    ...tool,
    source: "tool" as const,
  }));
}

function mergeActions(
  tools: string[],
  capabilities: AgentCapabilityId[]
): AgentActionItem[] {
  const fromTools = toolActionItems(tools);
  if (fromTools.length > 0) return fromTools;
  return capabilityLabels(capabilities);
}

function configFromApi(
  agentId: string,
  payload: ApiAgentResponse,
  key: AgentApiKeyRecord | null,
  isLive: boolean
): AgentSetupConfig {
  const lifecycle = loadAgentLifecycle(agentId);
  if (payload.agent.tools.length > 0 && !lifecycle.actionsConfigured) {
    saveAgentLifecycle(agentId, { actionsConfigured: true });
  }
  const protectionSettings = loadAgentProtectionSettings(agentId);
  const view = getAgentCardLifecycleView(agentId, key, lifecycle);
  const actions = mergeActions(payload.agent.tools, lifecycle.capabilities);
  const templateInfo = parseTemplateFromAgentSource(payload.agent.source);

  const config: AgentSetupConfig = {
    agentId,
    name: payload.agent.name,
    description: payload.agent.description,
    purpose: payload.agent.description,
    agentType: payload.agent.source === "zelta-builder" ? "Created with Wave" : "Connected agent",
    triggerLabel: labelTriggerType(payload.agent.triggerType),
    actions,
    hasActions: actions.length > 0,
    protection: {
      thresholdInr: payload.policy?.threshold ?? payload.agent.suggestedThreshold ?? protectionSettings.thresholdInr,
      autoAllowLowRisk: payload.policy?.autoAllow ?? protectionSettings.autoAllowLowRisk,
    },
    connection: {
      label: view.connectionLabel,
      keyPrefix: key?.keyPrefix ?? null,
      connected: view.connectionLabel === "Connected",
    },
    statusLabel: isLive ? "Live & Protected" : view.statusLabel,
    isLive,
    createdAt: formatCreatedAt(payload.agent.createdAt ?? key?.createdAt),
    templateName: templateInfo?.templateName,
    templateId: templateInfo?.templateId,
    templateSlug: templateInfo?.templateSlug,
    dataSource: "database",
  };

  saveAgentConfigCache({
    agentId,
    name: config.name,
    description: config.description,
    purpose: config.purpose,
    agentType: config.agentType,
    triggerType: payload.agent.triggerType,
    tools: payload.agent.tools,
    capabilities: lifecycle.capabilities,
    suggestedThreshold: config.protection.thresholdInr,
    updatedAt: new Date().toISOString(),
  });

  return config;
}

function configFromStored(
  stored: StoredAgentConfig,
  agentId: string,
  key: AgentApiKeyRecord | null,
  isLive: boolean
): AgentSetupConfig {
  const lifecycle = loadAgentLifecycle(agentId);
  const protectionSettings = loadAgentProtectionSettings(agentId);
  const view = getAgentCardLifecycleView(agentId, key, lifecycle);
  const actions = mergeActions(stored.tools, stored.capabilities.length ? stored.capabilities : lifecycle.capabilities);

  return {
    agentId,
    name: stored.name,
    description: stored.description,
    purpose: stored.purpose || stored.description,
    agentType:
      stored.agentType === "Created with Zelta"
        ? "Created with Wave"
        : stored.agentType,
    triggerLabel: labelTriggerType(stored.triggerType),
    actions,
    hasActions: actions.length > 0,
    protection: {
      thresholdInr: stored.suggestedThreshold ?? protectionSettings.thresholdInr,
      autoAllowLowRisk: protectionSettings.autoAllowLowRisk,
    },
    connection: {
      label: view.connectionLabel,
      keyPrefix: key?.keyPrefix ?? null,
      connected: view.connectionLabel === "Connected",
    },
    statusLabel: isLive ? "Live & Protected" : view.statusLabel,
    isLive,
    createdAt: formatCreatedAt(key?.createdAt),
    dataSource: "cache",
  };
}

function configFromSession(
  spec: AgentSpec,
  agentId: string,
  key: AgentApiKeyRecord | null,
  isLive: boolean,
  templateName?: string,
  templateSlug?: string
): AgentSetupConfig {
  const lifecycle = loadAgentLifecycle(agentId);
  const protectionSettings = loadAgentProtectionSettings(agentId);
  const view = getAgentCardLifecycleView(agentId, key, lifecycle);
  const tools = spec.tools.map((tool) => tool.toolName);
  const actions = mergeActions(tools, lifecycle.capabilities);

  const config: AgentSetupConfig = {
    agentId,
    name: spec.name,
    description: spec.summary || spec.purpose,
    purpose: spec.purpose || spec.summary,
    agentType: "Created with Wave",
    triggerLabel: "Configured at creation",
    actions,
    hasActions: actions.length > 0,
    protection: {
      thresholdInr: protectionSettings.thresholdInr,
      autoAllowLowRisk: protectionSettings.autoAllowLowRisk,
    },
    connection: {
      label: view.connectionLabel,
      keyPrefix: key?.keyPrefix ?? null,
      connected: view.connectionLabel === "Connected",
    },
    statusLabel: isLive ? "Live & Protected" : view.statusLabel,
    isLive,
    createdAt: formatCreatedAt(key?.createdAt),
    templateName,
    templateSlug,
    templateId: templateSlug,
    dataSource: "session",
  };

  saveAgentConfigCache({
    agentId,
    name: config.name,
    description: config.description,
    purpose: config.purpose,
    agentType: config.agentType,
    triggerType: "webhook",
    tools,
    capabilities: lifecycle.capabilities,
    suggestedThreshold: config.protection.thresholdInr,
    updatedAt: new Date().toISOString(),
  });

  return config;
}

function configFromFallback(
  agentId: string,
  key: AgentApiKeyRecord | null,
  isLive: boolean
): AgentSetupConfig {
  const lifecycle = loadAgentLifecycle(agentId);
  const protectionSettings = loadAgentProtectionSettings(agentId);
  const view = getAgentCardLifecycleView(agentId, key, lifecycle);
  const actions = capabilityLabels(lifecycle.capabilities);
  const name = key?.name ? humanizeAgentLabel(agentId, key.name) : humanizeAgentLabel(agentId, null);

  return {
    agentId,
    name,
    description: describeAgentPurpose(agentId, key?.name),
    purpose: describeAgentPurpose(agentId, key?.name),
    agentType: "Connected agent",
    triggerLabel: "Not configured",
    actions,
    hasActions: actions.length > 0,
    protection: {
      thresholdInr: protectionSettings.thresholdInr,
      autoAllowLowRisk: protectionSettings.autoAllowLowRisk,
    },
    connection: {
      label: view.connectionLabel,
      keyPrefix: key?.keyPrefix ?? null,
      connected: view.connectionLabel === "Connected",
    },
    statusLabel: isLive ? "Live & Protected" : view.statusLabel,
    isLive,
    createdAt: formatCreatedAt(key?.createdAt),
    dataSource: "fallback",
  };
}

export async function fetchAgentSetupConfig(
  agentId: string,
  key: AgentApiKeyRecord | null,
  isLive: boolean
): Promise<AgentSetupConfig> {
  try {
    const response = await fetch(`/api/v1/agents/${encodeURIComponent(agentId)}`);
    if (response.ok) {
      const payload = (await response.json()) as ApiAgentResponse;
      return configFromApi(agentId, payload, key, isLive);
    }
  } catch {
    // Fall through to local sources.
  }

  const cached = loadAgentConfigCache(agentId);
  if (cached) {
    return configFromStored(cached, agentId, key, isLive);
  }

  const session = loadCreatedAgentSession(agentId);
  if (session?.spec) {
    return configFromSession(
      session.spec,
      agentId,
      key,
      isLive,
      session.templateName,
      session.templateSlug
    );
  }

  return configFromFallback(agentId, key, isLive);
}

export function saveAgentConfigFromCreate(params: {
  agentId: string;
  name: string;
  description: string;
  purpose: string;
  triggerType: string;
  tools: string[];
  suggestedThreshold?: number | null;
}): void {
  saveAgentConfigCache({
    agentId: params.agentId,
    name: params.name,
    description: params.description,
    purpose: params.purpose,
    agentType: "Created with Wave",
    triggerType: params.triggerType,
    tools: params.tools,
    capabilities: [],
    suggestedThreshold: params.suggestedThreshold ?? null,
    updatedAt: new Date().toISOString(),
  });
}
