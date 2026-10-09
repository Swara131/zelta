import { listTemplates } from "@/lib/templates/repository";
import { countTemplatesByCategory } from "@/lib/templates/categories";
import { MARKETPLACE_TEMPLATES } from "@/lib/templates/marketplace-catalog";
import type { TemplateFilterId, TemplateListQuery, TemplateRiskLevel } from "@/lib/templates/types";
import { secureError, secureJson } from "@/lib/security/api";
import { createClient } from "@/lib/supabase/server";

const FILTER_VALUES = new Set<string>([
  "all",
  "sales-marketing",
  "customer-support",
  "operations-productivity",
  "finance-commerce",
  "developer-ai-safety",
]);

const RISK_VALUES = new Set<string>(["low", "medium", "high", "all"]);

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return secureError("Unauthorized", 401);
  }

  const { searchParams } = new URL(request.url);
  const rawCategory = searchParams.get("category") ?? "all";
  const category = FILTER_VALUES.has(rawCategory)
    ? (rawCategory as TemplateFilterId)
    : "all";
  const rawRisk = searchParams.get("risk") ?? "all";
  const riskLevel = RISK_VALUES.has(rawRisk)
    ? (rawRisk as TemplateRiskLevel | "all")
    : "all";
  const approvalParam = searchParams.get("requiresApproval");
  const requiresApproval =
    approvalParam === "true" ? true : approvalParam === "false" ? false : null;

  const query: TemplateListQuery = {
    category,
    search: searchParams.get("search"),
    riskLevel,
    requiresApproval,
    tool: searchParams.get("tool"),
  };

  const templates = await listTemplates(supabase, query);
  const counts = countTemplatesByCategory(MARKETPLACE_TEMPLATES);

  return secureJson({ templates, counts });
}
