import Link from "next/link";
import { CheckCircle2, FileText, Server, Shield } from "lucide-react";
import { COMPANY_NAME } from "@/lib/public-branding";
import { TRUST_FOOTER } from "@/lib/trust/dashboard-trust";
import { SETTINGS_LAST_SECURITY_AUDIT } from "@/lib/settings/trust-settings";

const FOOTER_COLUMNS = [
  {
    id: "support",
    icon: Shield,
    title: "Security Questions",
    links: [
      {
        href: "mailto:security@zelta.com",
        label: "Email security@zelta.com",
        external: true,
        className: "st-trust-footer-email-link",
      },
    ],
  },
  {
    id: "legal",
    icon: FileText,
    title: "Legal & Compliance",
    links: [
      { href: "/#features", label: "View Privacy Policy" },
      { href: "/#features", label: "View Terms of Service" },
    ],
  },
  {
    id: "audit",
    icon: CheckCircle2,
    title: "Audit Logs",
    description: "All account actions logged forever",
  },
  {
    id: "status",
    icon: Server,
    title: "Security Status",
    meta: [`Last audit: ${SETTINGS_LAST_SECURITY_AUDIT}`],
    status: TRUST_FOOTER.status,
  },
] as const;

export default function SettingsTrustFooter() {
  return (
    <footer className="st-trust-footer-wrap" aria-label="Security and trust information">
      <div className="st-trust-footer-card">
        <div className="st-trust-footer-grid">
          {FOOTER_COLUMNS.map((column) => {
            const Icon = column.icon;
            return (
              <div key={column.id} className="st-trust-footer-col">
                <span className="st-trust-footer-col-icon" aria-hidden="true">
                  <Icon className="h-5 w-5" strokeWidth={2} />
                </span>
                <h3 className="st-trust-footer-col-title">{column.title}</h3>

                {"description" in column && column.description ? (
                  <p className="st-trust-footer-col-desc">{column.description}</p>
                ) : null}

                {"meta" in column && column.meta
                  ? column.meta.map((line) => (
                      <p key={line} className="st-trust-footer-col-meta">
                        {line}
                      </p>
                    ))
                  : null}

                {"status" in column && column.status ? (
                  <p className="st-trust-footer-col-status">
                    <span className="st-trust-footer-status-dot" aria-hidden="true">
                      🟢
                    </span>
                    {column.status}
                  </p>
                ) : null}

                {"links" in column && column.links ? (
                  <ul className="st-trust-footer-col-links">
                    {column.links.map((link) => (
                      <li key={link.label}>
                        {"external" in link && link.external ? (
                          <a
                            href={link.href}
                            className={`st-trust-footer-link ${"className" in link ? link.className : ""}`.trim()}
                          >
                            {link.label}
                          </a>
                        ) : (
                          <Link href={link.href} className="st-trust-footer-link">
                            {link.label}
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            );
          })}
        </div>

        <p className="st-trust-footer-copyright">
          © 2026 {COMPANY_NAME} · {TRUST_FOOTER.tagline}
        </p>
      </div>
    </footer>
  );
}
