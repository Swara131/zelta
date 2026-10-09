import type { ToolExecutionOutcome } from "../../types";

/** Honest handler for tools without live connectors yet. */
export async function handleUnconfiguredTool(
  toolName: string,
  input: Record<string, unknown>
): Promise<ToolExecutionOutcome> {
  return {
    executed: false,
    error: `${toolName.replace(/_/g, " ")} connector is not configured in Wave yet.`,
    output: {
      toolName,
      receivedInput: input,
      hint: "The action was evaluated by Wave Protection but no live connector executed it.",
    },
  };
}
