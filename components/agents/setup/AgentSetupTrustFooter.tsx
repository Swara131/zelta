import Link from "next/link";

export default function AgentSetupTrustFooter() {
  return (
    <footer className="asp-footer" aria-label="Trust and compliance">
      <div className="asp-footer-left">
        <span>© 2026 Wave</span>
        <span className="asp-footer-sep" aria-hidden="true">
          |
        </span>
        <Link href="/security">Security</Link>
        <span className="asp-footer-sep" aria-hidden="true">
          |
        </span>
        <Link href="/privacy">Privacy</Link>
        <span className="asp-footer-sep" aria-hidden="true">
          |
        </span>
        <Link href="/terms">Terms</Link>
      </div>
      <p className="asp-footer-center">Enterprise-grade AI agent protection</p>
      <p className="asp-footer-right">
        Last audit: January 2026 · <span className="asp-footer-live">🟢 All systems operational</span>
      </p>
    </footer>
  );
}
