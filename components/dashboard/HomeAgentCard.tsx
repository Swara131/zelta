import Link from "next/link";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatRelativeTime } from "@/lib/audit/activity-copy";

interface HomeAgentCardProps {
  agentId: string;
  name: string;
  href: string;
  isLive: boolean;
  lastActionIso: string | null;
  actionsThisMonth: number;
  index: number;
}

export default function HomeAgentCard({
  name,
  href,
  isLive,
  lastActionIso,
  actionsThisMonth,
  index,
}: HomeAgentCardProps) {
  const lastActionLabel = lastActionIso
    ? formatRelativeTime(lastActionIso)
    : "No activity yet";

  const actionLabel =
    actionsThisMonth === 1
      ? "1 action this month"
      : `${actionsThisMonth} actions this month`;

  return (
    <li>
      <Link
        href={href}
        className="zhome-agent-card"
        style={{ animationDelay: `${index * 80}ms` }}
        aria-label={`Open ${name}`}
      >
        <StatusBadge tone={isLive ? "success" : "warning"}>
          {isLive ? "Live" : "Setup"}
        </StatusBadge>
        <span className="zhome-agent-name">{name}</span>
        <span className="zhome-agent-meta">Last run: {lastActionLabel}</span>
        <span className="zhome-agent-meta">{actionLabel}</span>
      </Link>
    </li>
  );
}
