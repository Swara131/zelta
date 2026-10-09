import ZeltaAppShell from "@/components/layout/ZeltaAppShell";
import TrustToastHost from "@/components/trust/TrustToastHost";

type MaxWidth = "4xl" | "5xl" | "6xl" | "7xl";
type PageLayout = "default" | "workspace";

const MAX_WIDTH: Record<MaxWidth, string> = {
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
  "7xl": "max-w-7xl",
};

interface PageShellProps {
  children: React.ReactNode;
  maxWidth?: MaxWidth;
  layout?: PageLayout;
  id?: string;
  className?: string;
}

export default function PageShell({
  children,
  maxWidth = "7xl",
  layout = "default",
  id = "main-content",
  className = "",
}: PageShellProps) {
  const isWorkspace = layout === "workspace";

  return (
    <ZeltaAppShell>
      <div
        className={`flex min-h-full flex-col ${isWorkspace ? "zpage-workspace-root" : ""} ${className}`.trim()}
      >
        <a href={`#${id}`} className="ds-skip-link">
          Skip to main content
        </a>
        <div
          id={id}
          className={
            isWorkspace
              ? "zpage-workspace flex min-h-0 flex-1 flex-col"
              : `ds-page mx-auto w-full flex-1 ${MAX_WIDTH[maxWidth]}`
          }
          tabIndex={-1}
        >
          {children}
        </div>
        <TrustToastHost />
      </div>
    </ZeltaAppShell>
  );
}
