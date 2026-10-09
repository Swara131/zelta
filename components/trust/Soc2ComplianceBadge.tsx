import Link from "next/link";
import { SOC2_COMPLIANCE_HREF } from "@/lib/trust/dashboard-trust";

interface Soc2ComplianceBadgeProps {
  className?: string;
}

export default function Soc2ComplianceBadge({ className = "" }: Soc2ComplianceBadgeProps) {
  return (
    <Link
      href={SOC2_COMPLIANCE_HREF}
      className={`trust-soc2-badge ${className}`.trim()}
      title="View compliance and security details"
    >
      <span aria-hidden="true">🔒</span>
      <span>SOC 2 Type II</span>
    </Link>
  );
}
