import {
  buildToolConnectionSummary,
  PLATFORM_TOOL_PROVIDERS,
  resolveConnectionStatus,
  getMissingRequirements,
} from "@/lib/agents/tools/connections";
import { listToolDefinitions } from "@/lib/agents/tools/catalog";
import { secureError, secureJson } from "@/lib/security/api";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return secureError("Unauthorized", 401);
  }

  const tools = listToolDefinitions().map((tool) => ({
    name: tool.name,
    label: tool.label,
    description: tool.description,
    riskLevel: tool.riskLevel,
    connections: buildToolConnectionSummary(tool),
  }));

  const providers = PLATFORM_TOOL_PROVIDERS.map((provider) => ({
    provider: provider.provider,
    label: provider.label,
    description: provider.description,
    status: resolveConnectionStatus(provider),
    missingRequirements: getMissingRequirements(provider),
    settingsPath: provider.settingsPath,
  }));

  return secureJson({ tools, providers });
}
