import AppHeader from "@/components/layout/AppHeader";
import AppFooter from "@/components/layout/AppFooter";

type MaxWidth = "4xl" | "6xl" | "7xl";

const MAX_WIDTH: Record<MaxWidth, string> = {
  "4xl": "max-w-4xl",
  "6xl": "max-w-6xl",
  "7xl": "max-w-7xl",
};

interface PageShellProps {
  children: React.ReactNode;
  maxWidth?: MaxWidth;
  id?: string;
  className?: string;
}

export default function PageShell({ children, maxWidth = "7xl", id = "main-content", className = "" }: PageShellProps) {
  return (
    <div className={`flex min-h-screen flex-col ${className}`.trim()}>
      <a href={`#${id}`} className="ds-skip-link">
        Skip to main content
      </a>
      <AppHeader />
      <main
        id={id}
        className={`ds-page mx-auto w-full flex-1 ${MAX_WIDTH[maxWidth]}`}
        tabIndex={-1}
      >
        {children}
      </main>
      <AppFooter />
    </div>
  );
}
