import Link from "next/link";
import { Shield } from "lucide-react";

const FOOTER_LINKS = {
  Product: [
    { href: "/upload", label: "Upload Logs" },
    { href: "/translator", label: "AI Translator" },
    { href: "/risk", label: "Risk Analysis" },
    { href: "/approvals", label: "Approvals" },
    { href: "/pipeline", label: "Pipeline" },
  ],
  Company: [
    { href: "#", label: "About" },
    { href: "#", label: "Blog" },
    { href: "#", label: "Careers" },
    { href: "#", label: "Contact" },
  ],
  Legal: [
    { href: "#", label: "Privacy" },
    { href: "#", label: "Terms" },
    { href: "#", label: "Security" },
    { href: "#", label: "SOC 2" },
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
                <Shield className="h-5 w-5 text-white" strokeWidth={2} />
              </div>
              <span className="text-lg font-semibold text-white">ApprovalLayer</span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-zinc-500">
              AI Approval Layer for Enterprise Security. Govern every agent action from
              upload to compliance.
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
            © {new Date().getFullYear()} ApprovalLayer. All rights reserved.
          </p>
          <p className="text-xs text-zinc-600">
            Built for teams who take agent security seriously.
          </p>
        </div>
      </div>
    </footer>
  );
}
