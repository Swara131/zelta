/** Public-facing brand constants. Internal package/API names remain unchanged. */

export const COMPANY_NAME = "Zelta";

export const TAGLINE = "AI Infrastructure for Autonomous Agents";

export const PRODUCT_NAME = "ApprovalLayer";

export const PRODUCT_SHORT_DESCRIPTION =
  "AI Safety Gateway for autonomous agents";

export const HERO_BODY =
  "ApprovalLayer is Zelta's AI Safety Gateway that helps autonomous AI agents safely execute high-impact actions using policies, hybrid AI risk classification, human approvals, audit trails, and execution tokens.";

export const DEFAULT_DESCRIPTION = HERO_BODY;

export const DASHBOARD_SUBTITLE = "ApprovalLayer Dashboard";

export function pageTitle(page?: string): string {
  return page ? `${page} | ${COMPANY_NAME}` : `${COMPANY_NAME} — ${TAGLINE}`;
}

export function getMetadataBase(): URL {
  const url = process.env.NEXT_PUBLIC_APP_URL?.trim();
  return new URL(url && url.length > 0 ? url : "http://localhost:3000");
}

export const SITE_METADATA = {
  siteName: COMPANY_NAME,
  title: `${COMPANY_NAME} — ${TAGLINE}`,
  description: DEFAULT_DESCRIPTION,
  openGraph: {
    type: "website" as const,
    siteName: COMPANY_NAME,
    title: `${COMPANY_NAME} — ${TAGLINE}`,
    description: DEFAULT_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image" as const,
    title: `${COMPANY_NAME} — ${TAGLINE}`,
    description: DEFAULT_DESCRIPTION,
  },
};
