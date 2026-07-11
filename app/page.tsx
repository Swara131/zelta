import type { Metadata } from "next";
import LandingPage from "@/components/landing/LandingPage";
import { COMPANY_NAME, DEFAULT_DESCRIPTION, PRODUCT_NAME, TAGLINE } from "@/lib/public-branding";

export const metadata: Metadata = {
  title: `${COMPANY_NAME} — ${TAGLINE}`,
  description: DEFAULT_DESCRIPTION,
  openGraph: {
    title: `${COMPANY_NAME} — ${TAGLINE}`,
    description: DEFAULT_DESCRIPTION,
  },
  twitter: {
    title: `${COMPANY_NAME} — ${TAGLINE}`,
    description: DEFAULT_DESCRIPTION,
  },
  keywords: [
    COMPANY_NAME,
    PRODUCT_NAME,
    "AI agents",
    "AI safety gateway",
    "agent governance",
    "execution tokens",
  ],
};

export default function Home() {
  return <LandingPage />;
}
