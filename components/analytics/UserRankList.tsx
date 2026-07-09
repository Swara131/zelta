import type { UserRank } from "@/lib/analytics-types";
import { AlertTriangle, Activity } from "lucide-react";

interface UserRankListProps {
  title: string;
  users: UserRank[];
  variant: "risky" | "active";
}

export default function UserRankList({ title, users, variant }: UserRankListProps) {
  const Icon = variant === "risky" ? AlertTriangle : Activity;
  const maxCount = Math.max(...users.map((u) => u.count));

  return (
    <div className="analytics-panel h-full p-5">
      <div className="mb-4 flex items-center gap-2">
        <Icon
          className={`h-4 w-4 ${variant === "risky" ? "text-red-400" : "text-indigo-400"}`}
          strokeWidth={2}
        />
        <p className="analytics-panel-title">{title}</p>
      </div>

      <div className="flex flex-col gap-3">
        {users.map((user, idx) => (
          <div key={user.name} className="group flex items-center gap-3">
            <span className="w-4 font-mono text-xs text-zinc-600">{idx + 1}</span>

            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold ring-1 ring-white/8"
              style={{
                background:
                  variant === "risky"
                    ? "rgba(248, 113, 113, 0.12)"
                    : "rgba(99, 102, 241, 0.12)",
                color: variant === "risky" ? "#f87171" : "#a5b4fc",
              }}
            >
              {user.avatar}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-medium text-zinc-200">{user.name}</p>
                {user.riskScore !== undefined && (
                  <span className="font-mono text-xs font-semibold text-red-400">
                    {user.riskScore}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-600">{user.department}</p>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${(user.count / maxCount) * 100}%`,
                    background:
                      variant === "risky"
                        ? "linear-gradient(90deg, #f87171, #fb923c)"
                        : "linear-gradient(90deg, #6366f1, #818cf8)",
                  }}
                />
              </div>
            </div>

            <span className="shrink-0 font-mono text-sm font-semibold text-zinc-400">
              {user.count.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
