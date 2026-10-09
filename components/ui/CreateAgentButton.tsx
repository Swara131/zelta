import Link from "next/link";
import { Plus } from "lucide-react";
import { CTA } from "@/lib/ux/cta-labels";

interface CreateAgentButtonProps {
  className?: string;
  size?: "default" | "sm";
}

export default function CreateAgentButton({
  className = "",
  size = "default",
}: CreateAgentButtonProps) {
  const sizeClass = size === "sm" ? "ds-btn-sm" : "";

  return (
    <Link
      href="/agents/create"
      className={`ds-btn ds-btn-primary inline-flex items-center gap-2 ${sizeClass} ${className}`.trim()}
    >
      <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
      {CTA.createAgent}
    </Link>
  );
}
