import { AgentRuntimeError } from "../runtime/errors";
import type {
  RegisteredTool,
  ToolExecutionOutcome,
  ToolHandlerContext,
} from "../runtime/types";
import {
  getToolDefinition,
  listToolDefinitions,
  resolveToolName,
} from "./catalog";
import type { ZeltaToolDefinition } from "./types";

function toRegisteredTool(tool: ZeltaToolDefinition): RegisteredTool {
  return {
    name: tool.name,
    actionType: tool.actionType,
    description: tool.description,
    inputSchema: tool.inputSchema,
    handler: tool.handler,
  };
}

export function listRegisteredTools(): RegisteredTool[] {
  return listToolDefinitions().map(toRegisteredTool);
}

export function isToolRegistered(toolName: string): boolean {
  return Boolean(getToolDefinition(toolName));
}

export async function executeRegisteredTool(
  toolName: string,
  input: Record<string, unknown>,
  context: ToolHandlerContext
): Promise<ToolExecutionOutcome> {
  const resolved = resolveToolName(toolName);
  const tool = getToolDefinition(resolved);

  if (!tool) {
    throw new AgentRuntimeError(`Unknown tool: ${toolName}`);
  }

  try {
    return await tool.handler(input, context);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Tool execution failed unexpectedly.";
    return {
      executed: false,
      error: message,
      output: { toolName: resolved },
    };
  }
}

export function assertToolEnabledForAgent(
  enabledTools: string[],
  toolName: string
): void {
  const resolved = resolveToolName(toolName);
  const normalizedEnabled = new Set(
    enabledTools.map((tool) => resolveToolName(tool))
  );

  if (!normalizedEnabled.has(resolved)) {
    throw new AgentRuntimeError(
      `Tool "${toolName}" is not enabled for this agent.`
    );
  }

  if (!isToolRegistered(resolved)) {
    throw new AgentRuntimeError(`Tool "${toolName}" is not registered in Wave.`);
  }
}

export function normalizeEnabledTools(tools: string[]): string[] {
  const normalized = tools.map((tool) => resolveToolName(tool));
  return [...new Set(normalized)];
}
