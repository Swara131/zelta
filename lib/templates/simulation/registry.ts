import { MARKETPLACE_TEMPLATES } from "@/lib/templates/marketplace-catalog";
import { buildDefaultScenario } from "./default-scenario";
import { FEATURED_SCENARIOS } from "./featured";
import type { DemoScenario } from "./types";

const featuredBySlug = new Map(FEATURED_SCENARIOS.map((item) => [item.templateSlug, item]));

export function getDemoScenario(templateSlug: string): DemoScenario | null {
  const slug = templateSlug.trim();
  if (!slug) return null;
  const featured = featuredBySlug.get(slug);
  if (featured) return featured;
  const template = MARKETPLACE_TEMPLATES.find((item) => item.slug === slug || item.id === slug);
  if (!template) return null;
  return buildDefaultScenario(template);
}

export function requireDemoScenario(templateSlug: string): DemoScenario {
  const scenario = getDemoScenario(templateSlug);
  if (!scenario) {
    throw new Error("Template simulation not found.");
  }
  return scenario;
}

export function listScenarioSlugs(): string[] {
  return MARKETPLACE_TEMPLATES.map((item) => item.slug ?? item.id);
}

export function isGenericCustomerDemoTitle(title: string): boolean {
  return /demo customer scenario/i.test(title);
}
