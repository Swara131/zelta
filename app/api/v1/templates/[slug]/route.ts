import { getTemplateById } from "@/lib/templates/repository";
import { getDemoScenario } from "@/lib/templates/simulation/registry";
import { secureError, secureJson } from "@/lib/security/api";
import { createClient } from "@/lib/supabase/server";

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return secureError("Unauthorized", 401);

  const { slug } = await context.params;
  const template = await getTemplateById(supabase, slug?.trim() ?? "");
  if (!template) {
    return secureJson({ success: false, error: "Template not found." }, { status: 404 });
  }

  return secureJson({
    success: true,
    template,
    scenario: getDemoScenario(template.slug ?? template.id),
  });
}
