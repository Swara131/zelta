import type { AgentRequirement } from "./types";

export class RequirementsNotReadyError extends Error {
  readonly missing: AgentRequirement[];

  constructor(missing: AgentRequirement[]) {
    super(
      missing.length
        ? "This agent still needs required setup before it can run. Open Prepare your agent to finish."
        : "Your agent isn't ready yet."
    );
    this.name = "RequirementsNotReadyError";
    this.missing = missing;
  }
}
