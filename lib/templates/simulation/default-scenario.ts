import type { AgentTemplate } from "@/lib/templates/types";
import type { DemoScenario } from "./types";

export function buildDefaultScenario(template: AgentTemplate): DemoScenario {
  const slug = template.slug ?? template.id;
  const risk = template.riskLevel ?? "medium";
  const tools = template.tools ?? [];
  const highImpact = tools.some((tool) =>
    ["issue_refund", "send_email", "send_whatsapp_message", "update_crm_record"].includes(tool)
  );
  const example = template.exampleTasks?.[0] ?? template.shortDescription ?? template.description;

  return {
    id: `sim-${slug}`,
    templateSlug: slug,
    title: `${template.name} simulation`,
    description: `Safe sandbox for ${template.name}. Sample data only.`,
    whatItDoes: template.shortDescription ?? template.summary,
    whatItWillNotDo:
      "Will not call live email, payment, CRM write, or delete APIs. This is a sandbox.",
    mode: "simulation",
    riskLevel: risk,
    tools,
    inputFields: [
      {
        id: "sample",
        label: "Sample input",
        placeholder: example,
        example,
        multiline: true,
      },
    ],
    actions: [
      {
        id: "run-sandbox",
        label: `Run ${template.name} sandbox`,
        description: "Walk the sample workflow without external side effects.",
        riskLevel: highImpact || risk === "high" ? "high" : "low",
        requiresApproval: highImpact || risk === "high",
        simulatedTool: template.tools[0] ?? "ai_reasoning",
        simulatedResult: `Sandbox output for ${template.name}: sample result generated from your input.`,
      },
    ],
    expectedSteps: [
      { id: "trigger", label: "Start from sample input" },
      { id: "work", label: "Run template steps" },
      { id: "safety", label: "Apply safety checks" },
      { id: "done", label: "Save simulation result" },
    ],
  };
}
