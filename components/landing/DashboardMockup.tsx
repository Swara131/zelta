"use client";

import { motion } from "framer-motion";
import { Shield, AlertTriangle, CheckCircle2, TrendingUp, Activity } from "lucide-react";

export default function DashboardMockup() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40, rotateX: 8 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ duration: 1, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="landing-mockup relative mx-auto w-full max-w-4xl perspective-[1200px]"
    >
      {/* Glow behind mockup */}
      <div className="absolute -inset-4 rounded-3xl bg-gradient-to-r from-indigo-500/20 via-violet-500/20 to-cyan-500/20 blur-2xl" />

      <motion.div
        whileHover={{ y: -4 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0c0c12]/90 shadow-2xl shadow-indigo-500/10 backdrop-blur-xl"
      >
        {/* Window chrome */}
        <div className="flex items-center gap-2 border-b border-white/8 px-4 py-3">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
          </div>
          <span className="ml-3 font-mono text-[11px] text-zinc-600">
            approvalayer.app/dashboard
          </span>
        </div>

        <div className="grid grid-cols-12 gap-3 p-4 sm:gap-4 sm:p-5">
          {/* Sidebar hint */}
          <div className="col-span-2 hidden space-y-2 sm:block">
            {[...Array(5)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + i * 0.08 }}
                className={`h-8 rounded-lg ${i === 1 ? "bg-indigo-500/20 ring-1 ring-indigo-400/30" : "bg-white/4"}`}
              />
            ))}
          </div>

          {/* Main content */}
          <div className="col-span-12 space-y-3 sm:col-span-10 sm:space-y-4">
            {/* KPI row */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
              {[
                { label: "Risk Score", value: "73", icon: Shield, color: "#f87171" },
                { label: "Pending", value: "12", icon: AlertTriangle, color: "#fbbf24" },
                { label: "Approved", value: "94%", icon: CheckCircle2, color: "#34d399" },
                { label: "Actions", value: "847", icon: Activity, color: "#818cf8" },
              ].map((kpi, i) => (
                <motion.div
                  key={kpi.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 + i * 0.1 }}
                  className="rounded-xl bg-white/3 p-3 ring-1 ring-white/6"
                >
                  <div className="flex items-center gap-2">
                    <kpi.icon className="h-3.5 w-3.5" style={{ color: kpi.color }} strokeWidth={2} />
                    <span className="text-[10px] text-zinc-500">{kpi.label}</span>
                  </div>
                  <p className="mt-1 font-mono text-xl font-bold text-zinc-100">{kpi.value}</p>
                </motion.div>
              ))}
            </div>

            {/* Chart + alerts */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9 }}
                className="col-span-3 rounded-xl bg-white/3 p-4 ring-1 ring-white/6"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-medium text-zinc-400">Risk trend</span>
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                </div>
                <svg viewBox="0 0 280 80" className="w-full">
                  <defs>
                    <linearGradient id="mockGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0 60 L40 55 L80 45 L120 50 L160 35 L200 30 L240 25 L280 20 L280 80 L0 80 Z"
                    fill="url(#mockGrad)"
                  />
                  <motion.path
                    d="M0 60 L40 55 L80 45 L120 50 L160 35 L200 30 L240 25 L280 20"
                    fill="none"
                    stroke="#818cf8"
                    strokeWidth="2"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1.5, delay: 1, ease: "easeOut" }}
                  />
                </svg>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.1 }}
                className="col-span-2 space-y-2"
              >
                {[
                  { text: "Secret access blocked", sev: "critical" },
                  { text: "Admin grant escalated", sev: "high" },
                  { text: "Query approved", sev: "low" },
                ].map((alert, i) => (
                  <motion.div
                    key={alert.text}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 1.2 + i * 0.15 }}
                    className="flex items-center gap-2 rounded-lg bg-white/3 px-3 py-2 ring-1 ring-white/5"
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{
                        background:
                          alert.sev === "critical"
                            ? "#f87171"
                            : alert.sev === "high"
                              ? "#fb923c"
                              : "#34d399",
                      }}
                    />
                    <span className="truncate text-[11px] text-zinc-400">{alert.text}</span>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
