import type { PolicyRuleDefinition } from "@/lib/gateway/policy/types";
import {
  PROTECTION_EXPLANATION,
  type PlainEnglishProtectionConfig,
} from "@/lib/protection/plain-english";
import { ChevronDown } from "lucide-react";

const SECTIONS = [
  {
    key: "allowed" as const,
    icon: "🟢",
    title: "Allowed automatically",
    subtitle: "Actions your agent can perform without asking you.",
    className: "pr-section-allow",
  },
  {
    key: "askFirst" as const,
    icon: "🟡",
    title: "Ask me first",
    subtitle: "Actions where Wave will pause the agent and ask for your approval.",
    className: "pr-section-review",
  },
  {
    key: "blocked" as const,
    icon: "🔴",
    title: "Always blocked",
    subtitle: "Actions your agent is never allowed to perform.",
    className: "pr-section-block",
  },
];

interface PlainEnglishProtectionProps {
  config: PlainEnglishProtectionConfig;
  showExplanation?: boolean;
  advancedPolicies?: PolicyRuleDefinition[];
  className?: string;
}

export default function PlainEnglishProtection({
  config,
  showExplanation = true,
  advancedPolicies,
  className = "",
}: PlainEnglishProtectionProps) {
  return (
    <div className={`pr-protection ${className}`.trim()}>
      <div className="pr-sections">
        {SECTIONS.map(({ key, icon, title, subtitle, className: sectionClass }) => {
          const items = config[key];
          return (
            <section
              key={key}
              className={`pr-section ${sectionClass}`}
              aria-labelledby={`pr-${key}-title`}
            >
              <header className="pr-section-header">
                <h3 id={`pr-${key}-title`} className="pr-section-title">
                  <span aria-hidden="true">{icon}</span>
                  {title}
                </h3>
                <p className="pr-section-subtitle">{subtitle}</p>
              </header>
              <ul className="pr-item-list">
                {items.map((item) => (
                  <li key={item.label} className="pr-item">
                    {item.label}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      {showExplanation ? (
        <p className="pr-explanation">{PROTECTION_EXPLANATION}</p>
      ) : null}

      {advancedPolicies && advancedPolicies.length > 0 ? (
        <details className="cp-advanced-setup pr-advanced">
          <summary className="cp-advanced-setup-summary">
            Advanced Protection Settings
            <ChevronDown className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          </summary>
          <div className="cp-advanced-setup-body">
            <p className="mb-2">
              Technical policy rules used by the gateway at runtime (for developers):
            </p>
            <pre className="ab-spec-json">
              {JSON.stringify(advancedPolicies, null, 2)}
            </pre>
          </div>
        </details>
      ) : null}
    </div>
  );
}
