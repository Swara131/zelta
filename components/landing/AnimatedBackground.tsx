"use client";

import { motion } from "framer-motion";

export default function AnimatedBackground() {
  return (
    <div className="landing-bg pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <motion.div
        className="landing-grid absolute inset-0 opacity-[0.18]"
        animate={{ backgroundPosition: ["0px 0px", "64px 64px"] }}
        transition={{ duration: 24, repeat: Infinity, ease: "linear" }}
        style={{
          backgroundImage: `
            linear-gradient(rgba(129, 140, 248, 0.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(129, 140, 248, 0.08) 1px, transparent 1px)
          `,
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(ellipse 85% 65% at 50% -10%, black, transparent)",
        }}
      />

      <motion.div
        className="absolute -left-32 top-0 h-[520px] w-[520px] rounded-full bg-indigo-600/25 blur-[130px]"
        animate={{ x: [0, 48, 0], y: [0, 36, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -right-24 top-1/4 h-[640px] w-[640px] rounded-full bg-violet-600/18 blur-[150px]"
        animate={{ x: [0, -56, 0], y: [0, -44, 0] }}
        transition={{ duration: 28, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-0 left-1/3 h-[420px] w-[420px] rounded-full bg-blue-600/12 blur-[110px]"
        animate={{ x: [0, 36, 0], scale: [1, 1.08, 1] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="absolute inset-x-0 top-0 h-[640px] bg-gradient-to-b from-indigo-950/50 via-transparent to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-[#06060a] to-transparent" />
    </div>
  );
}
