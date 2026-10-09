import type { AgentSafetySettings } from "@/lib/agents/runtime-types";
import type { SimulationRun } from "./types";

export function readSimulationRun(
  safety: AgentSafetySettings | null | undefined
): SimulationRun | null {
  return safety?.simulationState?.lastRun ?? null;
}

export function writeSimulationRun(
  safety: AgentSafetySettings,
  run: SimulationRun | null
): AgentSafetySettings {
  return {
    ...safety,
    simulationState: { lastRun: run },
  };
}
