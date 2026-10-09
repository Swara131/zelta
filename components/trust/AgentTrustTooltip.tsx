import type { ReactNode } from "react";
import { AGENT_TRUST_TOOLTIP } from "@/lib/trust/dashboard-trust";

interface AgentTrustTooltipProps {
  children: ReactNode;
  className?: string;
  enabled?: boolean;
}

export default function AgentTrustTooltip({
  children,
  className = "",
  enabled = true,
}: AgentTrustTooltipProps) {
  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <div className={`agent-trust-tooltip-wrap ${className}`.trim()}>
      {children}
      <span className="agent-trust-tooltip" role="tooltip">
        {AGENT_TRUST_TOOLTIP}
      </span>
    </div>
  );
}
