import Link from "next/link";
import { COMPANY_NAME } from "@/lib/public-branding";
import { TRUST_FOOTER } from "@/lib/trust/dashboard-trust";

const FOOTER_LINKS = [
  { href: "/settings#trust-compliance", label: "Security" },
  { href: "/#features", label: "Privacy Policy" },
  { href: "/#features", label: "Terms" },
] as const;

export default function AppFooter() {
  return (
    <footer className="app-trust-footer mt-auto border-t border-[var(--ds-border)]" role="contentinfo">
      <div className="app-trust-footer-inner mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <div className="app-trust-footer-row app-trust-footer-left">
          <span className="app-trust-footer-copy">© 2026 {COMPANY_NAME}</span>
          {FOOTER_LINKS.map((link) => (
            <Link key={link.label} href={link.href} className="app-trust-footer-link">
              {link.label}
            </Link>
          ))}
        </div>

        <p className="app-trust-footer-row app-trust-footer-center">{TRUST_FOOTER.tagline}</p>

        <div className="app-trust-footer-row app-trust-footer-right">
          <span>Last audit: {TRUST_FOOTER.lastAudit}</span>
          <span className="app-trust-footer-status">
            <span className="app-trust-footer-status-dot" aria-hidden="true" />
            Status: {TRUST_FOOTER.status}
          </span>
        </div>
      </div>
    </footer>
  );
}
