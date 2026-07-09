"use client";

import { motion } from "framer-motion";

export default function AnimatedBackground() {
  return (
    <div className="landing-bg pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Grid */}
      <div
        className="absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
          `,
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black, transparent)",
        }}
      />

      {/* Gradient orbs */}
      <motion.div
        className="absolute -left-32 top-0 h-[500px] w-[500px] rounded-full bg-indigo-600/20 blur-[120px]"
        animate={{ x: [0, 40, 0], y: [0, 30, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -right-32 top-1/4 h-[600px] w-[600px] rounded-full bg-violet-600/15 blur-[140px]"
        animate={{ x: [0, -50, 0], y: [0, -40, 0] }}
        transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-0 left-1/3 h-[400px] w-[400px] rounded-full bg-cyan-600/10 blur-[100px]"
        animate={{ x: [0, 30, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Top spotlight */}
      <div className="absolute inset-x-0 top-0 h-[600px] bg-gradient-to-b from-indigo-950/40 via-transparent to-transparent" />
    </div>
  );
}
