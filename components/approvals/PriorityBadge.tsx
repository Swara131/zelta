import type { ApprovalPriority } from "@/lib/approval-types";
import { PRIORITY_CONFIG } from "@/lib/dummy-approvals";

interface PriorityBadgeProps {
  priority: ApprovalPriority;
}

export default function PriorityBadge({ priority }: PriorityBadgeProps) {
  const config = PRIORITY_CONFIG[priority];

  return (
    <span
      className="inline-flex items-center rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider"
      style={{
        background: config.bg,
        color: config.color,
        border: `1px solid ${config.color}33`,
      }}
    >
      {config.label}
    </span>
  );
}
