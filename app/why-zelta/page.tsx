import type { Metadata } from "next";
import WhyZeltaPage from "@/components/marketing/WhyZeltaPage";
import { COMPANY_NAME } from "@/lib/public-branding";

export const metadata: Metadata = {
  title: `Why ${COMPANY_NAME} vs Others`,
  description:
    "Compare setup time, AI risk scoring, WhatsApp approvals, policy learning, and India pricing against typical agent governance tools.",
};

export default function WhyZeltaRoute() {
  return <WhyZeltaPage />;
}
