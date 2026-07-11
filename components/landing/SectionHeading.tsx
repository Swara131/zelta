"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";

interface SectionHeadingProps {
  eyebrow: string;
  title: ReactNode;
  description?: string;
  align?: "left" | "center";
  accent?: "indigo" | "violet" | "cyan" | "emerald" | "red" | "zinc";
}

const ACCENT: Record<NonNullable<SectionHeadingProps["accent"]>, string> = {
  indigo: "text-indigo-400",
  violet: "text-violet-400",
  cyan: "text-cyan-400",
  emerald: "text-emerald-400",
  red: "text-red-400",
  zinc: "text-zinc-500",
};

export default function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  accent = "indigo",
}: SectionHeadingProps) {
  const centered = align === "center";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5 }}
      className={`mb-14 max-w-2xl ${centered ? "mx-auto text-center" : ""}`}
    >
      <p className={`text-sm font-semibold uppercase tracking-wider ${ACCENT[accent]}`}>
        {eyebrow}
      </p>
      <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">{title}</h2>
      {description && (
        <p className={`mt-4 text-base leading-relaxed text-zinc-400 ${centered ? "mx-auto" : ""}`}>
          {description}
        </p>
      )}
    </motion.div>
  );
}
