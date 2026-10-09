import { Shield } from "lucide-react";
import type { SafetyDecisionLabel, SafetyPolicyRow } from "@/lib/safety/center/types";
import { DecisionBadge, PolicyStatusBadge } from "./SafetyBadges";

function policyAccentClass(decision: SafetyDecisionLabel): string {
  if (decision === "BLOCK") return "sc-policy-block";
  if (decision === "REQUIRE_APPROVAL") return "sc-policy-review";
  return "sc-policy-allow";
}

export default function SafetyPolicyCards({ policies }: { policies: SafetyPolicyRow[] }) {
  return (
    <ul className="sc-policy-list">
      {policies.slice(0, 20).map((policy, index) => (
        <li key={policy.id}>
          <article
            className={`sc-policy-card ${policyAccentClass(policy.decision)}`}
            style={{ animationDelay: `${index * 40}ms` }}
          >
            <div className="sc-policy-accent" aria-hidden="true" />
            <div className="sc-policy-icon" aria-hidden="true">
              <Shield strokeWidth={2} />
            </div>
            <div className="sc-policy-body">
              <h3 className="sc-policy-name">{policy.name}</h3>
              <p className="sc-policy-meta">
                {policy.agentName ?? "All agents"}
              </p>
              <p className="sc-policy-rule">{policy.rule}</p>
            </div>
            <div className="sc-policy-actions">
              <DecisionBadge decision={policy.decision} />
              <PolicyStatusBadge status={policy.status} />
            </div>
          </article>
        </li>
      ))}
    </ul>
  );
}
