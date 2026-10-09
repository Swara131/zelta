import { snapshotFromBuilderAgent } from "./from-agent";
import { getAgentRequirements } from "./engine";
import { RequirementsNotReadyError } from "./errors";
import type { BuilderAgentRecord } from "@/lib/agents/runtime-types";
import type { RequirementStage } from "./types";

export function assertBuilderAgentRequirementsReady(
  agent: BuilderAgentRecord,
  stage: RequirementStage
): void {
  const result = getAgentRequirements(snapshotFromBuilderAgent(agent, { stage }));
  if (!result.ready) {
    throw new RequirementsNotReadyError(result.missing);
  }
}
