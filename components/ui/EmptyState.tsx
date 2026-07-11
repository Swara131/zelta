import type { LucideIcon } from "lucide-react";
import Button from "./Button";
import { COMPANY_NAME, PRODUCT_NAME } from "@/lib/public-branding";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionIcon?: LucideIcon;
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  actionIcon,
}: EmptyStateProps) {
  return (
    <div className="ds-empty" role="status">
      <div className="ds-empty-icon" aria-hidden="true">
        <Icon className="h-8 w-8" strokeWidth={1.5} />
      </div>
      <h3 className="ds-empty-title">{title}</h3>
      <p className="ds-empty-description">{description}</p>
      {actionLabel && onAction && (
        <Button
          variant="primary"
          icon={actionIcon}
          onClick={onAction}
          className="mt-6"
        >
          {actionLabel}
        </Button>
      )}
      <p className="mt-6 text-xs text-[var(--ds-text-tertiary)]">
        {COMPANY_NAME} · {PRODUCT_NAME}
      </p>
    </div>
  );
}
