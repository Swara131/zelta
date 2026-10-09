import type { NextResponse } from "next/server";

/**
 * Next 16 + Turbopack can match /api/v1/agents/[agentId] ahead of static
 * siblings (interpret, save-draft, sources, …), so POST/GET to those URLs
 * never reach their route files. Dispatch reserved slugs here.
 */
const COLLECTION_SLUGS = new Set([
  "interpret",
  "save-draft",
  "sources",
  "build",
  "create-simple",
  "create-from-template",
  "publish-draft",
]);

export function isAgentCollectionSlug(slug: string): boolean {
  return COLLECTION_SLUGS.has(slug);
}

export async function dispatchAgentCollectionRoute(
  slug: string,
  request: Request
): Promise<NextResponse | Response | null> {
  if (!COLLECTION_SLUGS.has(slug)) return null;

  switch (`${request.method}:${slug}`) {
    case "POST:interpret": {
      const { POST } = await import("../interpret/route");
      return POST(request);
    }
    case "POST:save-draft": {
      const { POST } = await import("../save-draft/route");
      return POST(request);
    }
    case "POST:build": {
      const { POST } = await import("../build/route");
      return POST(request);
    }
    case "POST:create-simple": {
      const { POST } = await import("../create-simple/route");
      return POST(request);
    }
    case "POST:create-from-template": {
      const { POST } = await import("../create-from-template/route");
      return POST(request);
    }
    case "POST:publish-draft": {
      const { POST } = await import("../publish-draft/route");
      return POST(request);
    }
    case "GET:sources": {
      const { GET } = await import("../sources/route");
      return GET();
    }
    default:
      return null;
  }
}
