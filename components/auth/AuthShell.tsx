import Link from "next/link";
import { Shield } from "lucide-react";
import type { ReactNode } from "react";
import { COMPANY_NAME, TAGLINE } from "@/lib/public-branding";

interface AuthShellProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export default function AuthShell({ title, description, children }: AuthShellProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12 app-bg">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="mb-8 flex flex-col items-center justify-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-brand)]"
          aria-label={`${COMPANY_NAME} home`}
        >
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-[var(--ds-radius-sm)] bg-[var(--ds-brand)] shadow-[var(--ds-shadow-brand)]">
              <Shield className="h-5 w-5 text-white" strokeWidth={2} aria-hidden="true" />
            </div>
            <span className="text-lg font-semibold tracking-tight text-[var(--ds-text-primary)]">
              {COMPANY_NAME}
            </span>
          </div>
          <span className="text-sm text-[var(--ds-text-tertiary)]">{TAGLINE}</span>
        </Link>

        <div className="ds-panel p-6 sm:p-8">
          <h1 className="ds-page-title text-xl sm:text-2xl">{title}</h1>
          {description && (
            <p className="ds-page-description !mt-2">{description}</p>
          )}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
