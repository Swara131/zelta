import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export default function SectionHeader({
  title,
  description,
  icon: Icon,
  trailing,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  trailing?: ReactNode;
}) {
  return (
    <div className="ds-section-header">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {Icon ? (
              <Icon className="h-5 w-5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            ) : null}
            <h2 className="ds-section-title">{title}</h2>
          </div>
          {description ? <p className="ds-section-desc">{description}</p> : null}
        </div>
        {trailing}
      </div>
    </div>
  );
}
