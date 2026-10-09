"use client";

import { MotionConfig } from "framer-motion";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

export default function MotionRoot({ children }: { children: ReactNode }) {
  const [reducedMotion, setReducedMotion] = useState<"never" | "always">("never");

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(media.matches ? "always" : "never");
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return <MotionConfig reducedMotion={reducedMotion}>{children}</MotionConfig>;
}
