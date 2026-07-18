"use client";

import { useEffect, useState, type ReactNode } from "react";
import { fetchDemoModeEnabled } from "@/hooks/useDemoMode";

export default function DemoModeBadge() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    void fetchDemoModeEnabled().then(setEnabled);
  }, []);

  if (!enabled) {
    return null;
  }

  return (
    <span className="ds-badge ds-badge-demo" aria-label="Demo mode active">
      Demo Mode
    </span>
  );
}

export function PageHeaderBadges({ children }: { children?: ReactNode }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {children}
      <DemoModeBadge />
    </span>
  );
}
