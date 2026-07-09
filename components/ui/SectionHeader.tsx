import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface SectionHeaderProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  trailing?: ReactNode;
}

export default function SectionHeader({
  icon: Icon,
  title,
  description,
  trailing,
}: SectionHeaderProps) {
  return (
    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2 min-w-0">
        {Icon && (
          <Icon className="h-4 w-4 shrink-0 text-[var(--ds-text-tertiary)]" strokeWidth={2} aria-hidden="true" />
        )}
        <div>
          <h2 className="ds-section-title">{title}</h2>
          {description && <p className="ds-section-description">{description}</p>}
        </div>
      </div>
      {trailing}
    </div>
  );
}
