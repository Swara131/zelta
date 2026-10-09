import type { AgentCapabilityEntry, AgentScheduleConfig } from "./runtime-types";
import type { BuilderCapabilityId } from "./builder-capabilities";
import type { AgentDeliveryMode } from "./delivery/types";

export type BuilderWizardStep =
  | "describe"
  | "review"
  | "capabilities"
  | "schedule"
  | "test"
  | "publish";

export const BUILDER_WIZARD_STEPS: Array<{ id: BuilderWizardStep; label: string }> = [
  { id: "describe", label: "Describe" },
  { id: "review", label: "Review" },
  { id: "capabilities", label: "Capabilities" },
  { id: "schedule", label: "Schedule" },
  { id: "test", label: "Test" },
  { id: "publish", label: "Publish" },
];

export interface AgentInterpretation {
  displayName: string;
  goal: string;
  instructions: string;
  scheduleSummary: string;
  schedule: AgentScheduleConfig;
  timezone: string;
  capabilityIds: BuilderCapabilityId[];
  capabilities: AgentCapabilityEntry[];
  tools: string[];
  protectionSummary: string;
  triggerType: "email" | "webhook" | "schedule";
  suggestedThreshold: number;
  originalDescription: string;
  deliveryMode: AgentDeliveryMode;
}

export interface BuilderAgentDraft {
  agentId: string;
  agentDbId: string;
  slug: string;
  displayName: string;
  goal: string;
  instructions: string;
  scheduleSummary: string;
  schedule: AgentScheduleConfig;
  timezone: string;
  capabilityIds: BuilderCapabilityId[];
  capabilities: AgentCapabilityEntry[];
  tools: string[];
  protectionSummary: string;
  triggerType: "email" | "webhook" | "schedule";
  suggestedThreshold: number;
  status: string;
  apiKey?: string;
  keyPrefix?: string;
}

export type BuilderScheduleChoice =
  | "manual"
  | "daily"
  | "weekly"
  | "at_time"
  | "on_event";

export const BUILDER_SCHEDULE_OPTIONS: Array<{
  id: BuilderScheduleChoice;
  label: string;
  description: string;
}> = [
  {
    id: "manual",
    label: "When I run it",
    description: "Run only when you start it",
  },
  {
    id: "daily",
    label: "Every day",
    description: "Runs once each day at 9:00 AM",
  },
  {
    id: "weekly",
    label: "Every week",
    description: "Runs on selected days each week",
  },
  {
    id: "at_time",
    label: "At a specific time",
    description: "Pick the exact time you want",
  },
  {
    id: "on_event",
    label: "When something happens",
    description: "Starts when Wave receives a signal",
  },
];
