"use client";

import { useState } from "react";
import { Link2, Link2Off, Settings, RefreshCw, CheckCircle2 } from "lucide-react";
import IntegrationLogo from "./IntegrationLogo";
import type { Integration, IntegrationStatus } from "@/lib/integration-types";
import { STATUS_CONFIG, CATEGORY_LABELS } from "@/lib/dummy-integrations";

interface IntegrationCardProps {
  integration: Integration;
  index: number;
  onStatusChange: (id: string, status: IntegrationStatus) => void;
}

export default function IntegrationCard({
  integration,
  index,
  onStatusChange,
}: IntegrationCardProps) {
  const [loading, setLoading] = useState(false);
  const status = STATUS_CONFIG[integration.status];

  const handleConnect = async () => {
    setLoading(true);
    onStatusChange(integration.id, "pending");
    await new Promise((r) => setTimeout(r, 1500));
    onStatusChange(integration.id, "connected");
    setLoading(false);
  };

  const handleDisconnect = async () => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 600));
    onStatusChange(integration.id, "disconnected");
    setLoading(false);
  };

  const handleRetry = async () => {
    setLoading(true);
    onStatusChange(integration.id, "pending");
    await new Promise((r) => setTimeout(r, 1200));
    onStatusChange(integration.id, "connected");
    setLoading(false);
  };

  return (
    <article
      className={`integration-card glass-strong group flex flex-col overflow-hidden rounded-2xl ring-1 transition-all duration-300 hover:ring-white/14 ${
        integration.status === "connected"
          ? "ring-emerald-400/15"
          : integration.status === "error"
            ? "ring-red-400/15"
            : "ring-white/8"
      }`}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Brand accent */}
      <div
        className="h-0.5 opacity-60 transition-opacity group-hover:opacity-100"
        style={{ background: integration.brandColor }}
      />

      <div className="flex flex-1 flex-col p-5 sm:p-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl ring-1 ring-white/8"
            style={{ background: `${integration.brandColor}12` }}
          >
            <IntegrationLogo logoKey={integration.logoKey} className="h-8 w-8" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-zinc-100">{integration.name}</h3>
              <span className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                {CATEGORY_LABELS[integration.category]}
              </span>
            </div>

            {/* Status */}
            <div className="mt-2 flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${status.dot}`} />
              <span className="text-xs font-semibold" style={{ color: status.color }}>
                {status.label}
              </span>
            </div>
          </div>
        </div>

        {/* Description */}
        <p className="mt-4 flex-1 text-sm leading-relaxed text-zinc-500">
          {integration.description}
        </p>

        {/* Sync info for connected */}
        {integration.status === "connected" && integration.lastSync && (
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-zinc-600">
            <CheckCircle2 className="h-3 w-3 text-emerald-500" strokeWidth={2} />
            Last synced{" "}
            {new Date(integration.lastSync).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        )}

        {/* Actions */}
        <div className="mt-5 flex flex-wrap gap-2 border-t border-white/6 pt-4">
          {integration.status === "connected" ? (
            <>
              <button
                type="button"
                className="integration-btn integration-btn-secondary inline-flex items-center gap-2"
              >
                <Settings className="h-4 w-4" strokeWidth={2} />
                Configure
              </button>
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={loading}
                className="integration-btn integration-btn-disconnect inline-flex items-center gap-2"
              >
                {loading ? (
                  <span className="approval-btn-spinner" />
                ) : (
                  <Link2Off className="h-4 w-4" strokeWidth={2} />
                )}
                Disconnect
              </button>
            </>
          ) : integration.status === "error" ? (
            <button
              type="button"
              onClick={handleRetry}
              disabled={loading}
              className="integration-btn integration-btn-connect inline-flex items-center gap-2"
            >
              {loading ? (
                <span className="approval-btn-spinner" />
              ) : (
                <RefreshCw className="h-4 w-4" strokeWidth={2} />
              )}
              Retry Connection
            </button>
          ) : integration.status === "pending" ? (
            <button
              type="button"
              disabled
              className="integration-btn integration-btn-connect inline-flex items-center gap-2 opacity-60"
            >
              <span className="approval-btn-spinner" />
              Connecting…
            </button>
          ) : (
            <button
              type="button"
              onClick={handleConnect}
              disabled={loading}
              className="integration-btn integration-btn-connect inline-flex w-full items-center justify-center gap-2 sm:w-auto"
            >
              {loading ? (
                <span className="approval-btn-spinner" />
              ) : (
                <Link2 className="h-4 w-4" strokeWidth={2} />
              )}
              Connect
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
