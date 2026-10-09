import TemplateLibraryPage from "@/components/agents/templates/TemplateLibraryPage";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Agent templates",
  description: "Choose a template, customize it, and launch with safety controls already configured.",
};

export default function DashboardTemplatesPage() {
  return <TemplateLibraryPage />;
}
