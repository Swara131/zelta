import type { SupabaseClient } from "@supabase/supabase-js";
import { ALLOWED_AGENT_TOOLS } from "@/lib/xai/parse-agent-build";
import { filterTemplates } from "./categories";
import { getMarketplaceTemplateById, MARKETPLACE_TEMPLATES } from "./marketplace-catalog";
import { LEGACY_TEMPLATE_SEED_DATA } from "./seed-data";
import type { AgentTemplate, TemplateListQuery } from "./types";

interface TemplateRow {
  id: string;
  name: string;
  description: string;
  summary: string;
  icon: string;
  category: string;
  default_description: string;
  tools: unknown;
  trigger_type: string;
  supports_threshold: boolean;
  default_threshold: number | null;
  created_at: string;
  slug?: string | null;
  short_description?: string | null;
  long_description?: string | null;
  tags?: unknown;
  risk_level?: string | null;
  estimated_setup_minutes?: number | null;
  suggested_tools?: unknown;
  default_instructions?: string | null;
  example_tasks?: unknown;
  default_trigger?: string | null;
  default_safety_preset?: string | null;
  default_tool_permissions?: unknown;
  default_approval_rules?: unknown;
  default_execution_limits?: unknown;
  default_data_protection?: unknown;
  is_featured?: boolean | null;
  is_published?: boolean | null;
  sort_order?: number | null;
}

const ALLOWED_TOOL_SET = new Set<string>(ALLOWED_AGENT_TOOLS);

function mapTemplateRow(row: TemplateRow): AgentTemplate | null {
  const catalog = getMarketplaceTemplateById(row.slug ?? row.id);
  const tools = Array.isArray(row.tools)
    ? row.tools
        .filter((tool): tool is string => typeof tool === "string")
        .map((tool) => tool.trim())
        .filter((tool) => ALLOWED_TOOL_SET.has(tool))
    : catalog?.tools ?? [];

  if (tools.length === 0) return catalog;

  const triggerType =
    row.trigger_type === "email" ||
    row.trigger_type === "webhook" ||
    row.trigger_type === "schedule"
      ? row.trigger_type
      : catalog?.triggerType ?? "webhook";

  const base: AgentTemplate = catalog ?? {
    id: row.id,
    name: row.name,
    description: row.description,
    summary: row.summary || row.description,
    icon: row.icon,
    category: row.category as AgentTemplate["category"],
    defaultDescription: row.default_description,
    tools: tools as AgentTemplate["tools"],
    triggerType,
    supportsThreshold: row.supports_threshold,
    defaultThreshold: row.default_threshold,
    createdAt: row.created_at,
    isPublished: row.is_published !== false,
  };

  return {
    ...base,
    id: row.id,
    name: row.name || base.name,
    description: row.short_description || row.description || base.description,
    summary: row.summary || base.summary,
    slug: row.slug ?? base.slug ?? row.id,
    isPublished: row.is_published !== false,
    isFeatured: row.is_featured ?? base.isFeatured,
    sortOrder: row.sort_order ?? base.sortOrder,
    createdAt: row.created_at,
  };
}

function publishedCatalog(): AgentTemplate[] {
  return MARKETPLACE_TEMPLATES.filter((template) => template.isPublished !== false);
}

export async function listTemplates(
  supabase: SupabaseClient,
  params?: TemplateListQuery
): Promise<AgentTemplate[]> {
  const { data, error } = await supabase
    .from("templates")
    .select("*")
    .eq("is_published", true)
    .order("sort_order", { ascending: true });

  if (error || !data?.length) {
    return filterTemplates(publishedCatalog(), params);
  }

  const mapped = data
    .map((row) => mapTemplateRow(row as TemplateRow))
    .filter((template): template is AgentTemplate => template !== null);

  if (mapped.length < 20) {
    return filterTemplates(publishedCatalog(), params);
  }

  return filterTemplates(mapped, params);
}

export async function getTemplateById(
  supabase: SupabaseClient,
  templateId: string
): Promise<AgentTemplate | null> {
  const fromCatalog = getMarketplaceTemplateById(templateId);
  if (fromCatalog) return fromCatalog;

  const { data, error } = await supabase
    .from("templates")
    .select("*")
    .eq("id", templateId)
    .maybeSingle();

  if (!error && data) {
    return mapTemplateRow(data as TemplateRow);
  }

  const bySlug = await supabase
    .from("templates")
    .select("*")
    .eq("slug", templateId)
    .maybeSingle();

  if (!bySlug.error && bySlug.data) {
    return mapTemplateRow(bySlug.data as TemplateRow);
  }

  return LEGACY_TEMPLATE_SEED_DATA.find((template) => template.id === templateId) ?? null;
}
