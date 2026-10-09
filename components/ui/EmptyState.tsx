import Link from "next/link";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  primaryAction?: { label: string; href: string };
  secondaryAction?: { label: string; href: string };
  /** Button-style primary action (e.g. open file picker). */
  actionLabel?: string;
  actionIcon?: LucideIcon;
  onAction?: () => void;
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  actionLabel,
  actionIcon: ActionIcon,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="es-empty ds-panel">
      <div className="es-icon" aria-hidden="true">
        <Icon className="h-8 w-8" strokeWidth={1.75} />
      </div>
      <h3 className="es-title">{title}</h3>
      <p className="es-desc">{description}</p>
      {primaryAction || secondaryAction || (actionLabel && onAction) ? (
        <div className="es-actions">
          {primaryAction ? (
            <Link href={primaryAction.href} className="ds-btn ds-btn-primary">
              {primaryAction.label}
            </Link>
          ) : null}
          {actionLabel && onAction ? (
            <button type="button" className="ds-btn ds-btn-primary" onClick={onAction}>
              {ActionIcon ? (
                <ActionIcon className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              ) : null}
              {actionLabel}
            </button>
          ) : null}
          {secondaryAction ? (
            <Link href={secondaryAction.href} className="ds-btn ds-btn-secondary">
              {secondaryAction.label}
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
