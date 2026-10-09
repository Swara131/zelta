export interface AgentProtectionSettings {
  thresholdInr: number;
  autoAllowLowRisk: boolean;
}

const PREFIX = "zelta:agent-protection-settings:";

const DEFAULT_SETTINGS: AgentProtectionSettings = {
  thresholdInr: 5_000,
  autoAllowLowRisk: true,
};

export function loadAgentProtectionSettings(agentId: string): AgentProtectionSettings {
  if (typeof window === "undefined") return { ...DEFAULT_SETTINGS };

  try {
    const raw = window.localStorage.getItem(`${PREFIX}${agentId}`);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AgentProtectionSettings>;
    return {
      thresholdInr:
        typeof parsed.thresholdInr === "number" && parsed.thresholdInr > 0
          ? parsed.thresholdInr
          : DEFAULT_SETTINGS.thresholdInr,
      autoAllowLowRisk:
        typeof parsed.autoAllowLowRisk === "boolean"
          ? parsed.autoAllowLowRisk
          : DEFAULT_SETTINGS.autoAllowLowRisk,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveAgentProtectionSettings(
  agentId: string,
  settings: AgentProtectionSettings
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${PREFIX}${agentId}`, JSON.stringify(settings));
  } catch {
    // no-op
  }
}
