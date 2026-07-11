import Link from "next/link";
import { Shield } from "lucide-react";
import { COMPANY_NAME, HERO_BODY, PRODUCT_NAME } from "@/lib/public-branding";

const FOOTER_LINKS = {
  Product: [
    { href: "#how-it-works", label: "How it works" },
    { href: "#features", label: "Features" },
    { href: "#architecture", label: "Architecture" },
    { href: "#developers", label: "Developers" },
    { href: "#pricing", label: "Pricing" },
  ],
  Resources: [
    { href: "/integrations", label: "Integration guide" },
    { href: "/login", label: "Sign in" },
    { href: "/signup", label: "Create account" },
    { href: "/billing", label: "Billing" },
  ],
  Legal: [
    { href: "#", label: "Privacy" },
    { href: "#", label: "Terms" },
    { href: "#", label: "Security" },
  ],
};

export default function LandingFooter() {
  return (
    <footer className="border-t border-white/8 bg-[#06060a]">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600">
                <Shield className="h-5 w-5 text-white" strokeWidth={2} aria-hidden="true" />
              </div>
              <span className="text-lg font-semibold text-white">{COMPANY_NAME}</span>
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-zinc-500">{HERO_BODY}</p>
            <p className="mt-3 text-xs font-medium uppercase tracking-wider text-zinc-600">
              {PRODUCT_NAME} · AI Safety Gateway
            </p>
          </div>

          {Object.entries(FOOTER_LINKS).map(([title, links]) => (
            <div key={title}>
              <h4 className="text-sm font-semibold text-zinc-300">{title}</h4>
              <ul className="mt-4 space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-zinc-500 transition-colors hover:text-zinc-300"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-white/6 pt-8 sm:flex-row">
          <p className="text-xs text-zinc-600">
            © {new Date().getFullYear()} {COMPANY_NAME}
          </p>
          <p className="text-xs text-zinc-600">Built for teams shipping autonomous agents.</p>
        </div>
      </div>
    </footer>
  );
}
