import { COMPANY_NAME } from "@/lib/public-branding";

export default function AppFooter() {
  return (
    <footer
      className="mt-auto border-t border-[var(--ds-border)] py-8 text-center"
      role="contentinfo"
    >
      <p className="ds-caption">
        © {new Date().getFullYear()} {COMPANY_NAME}
      </p>
    </footer>
  );
}
