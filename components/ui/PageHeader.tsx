import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface PageHeaderProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  badge?: ReactNode;
  actions?: ReactNode;
}

export default function PageHeader({
  icon: Icon,
  title,
  description,
  badge,
  actions,
}: PageHeaderProps) {
  return (
    <header className="ds-page-header fade-in-up">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            {Icon && (
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--ds-radius-sm)] bg-[var(--ds-brand-muted)] text-[var(--ds-brand)]"
                aria-hidden="true"
              >
                <Icon className="h-5 w-5" strokeWidth={1.75} />
              </div>
            )}
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="ds-page-title">{title}</h1>
                {badge}
              </div>
            </div>
          </div>
          {description && <p className="ds-page-description">{description}</p>}
        </div>
        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
    </header>
  );
}
