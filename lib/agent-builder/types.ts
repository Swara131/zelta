export type ProtectionLevel = "allow" | "review" | "block";

export interface AgentToolSpec {
  id: string;
  label: string;
  icon: string;
  toolName: string;
  actionType: string;
}

export interface ProtectionRuleSpec {
  level: ProtectionLevel;
  label: string;
  description: string;
}

export interface AgentSpec {
  name: string;
  agentId: string;
  summary: string;
  purpose: string;
  tools: AgentToolSpec[];
  protection: ProtectionRuleSpec[];
  generatedAt: string;
  source: "groq" | "fallback" | "gemini" | "grok";
  model?: string;
}
