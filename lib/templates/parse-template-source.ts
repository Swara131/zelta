import { getMarketplaceTemplateById } from "./marketplace-catalog";
import { LEGACY_TEMPLATE_SEED_DATA } from "./seed-data";

export function parseTemplateFromAgentSource(source: string | null | undefined): {
  templateId: string;
  templateSlug: string;
  templateName: string;
} | null {
  if (!source?.startsWith("template:")) return null;

  const templateId = source.slice("template:".length).trim();
  if (!templateId) return null;

  const marketplace = getMarketplaceTemplateById(templateId);
  const legacy = LEGACY_TEMPLATE_SEED_DATA.find((template) => template.id === templateId);
  return {
    templateId,
    templateSlug: marketplace?.slug ?? templateId,
    templateName: marketplace?.name ?? legacy?.name ?? templateId,
  };
}
