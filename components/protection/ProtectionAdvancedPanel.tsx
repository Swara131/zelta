"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  Download,
  FileText,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import SectionHeader from "@/components/ui/SectionHeader";
import Button from "@/components/ui/Button";
import RiskGauge from "@/components/risk/RiskGauge";
import RiskSummaryCards from "@/components/risk/RiskSummaryCards";
import RiskPieChart from "@/components/risk/RiskPieChart";
import RiskLineChart from "@/components/risk/RiskLineChart";
import DetectedRiskCard from "@/components/risk/DetectedRiskCard";
import type { RiskAnalysisSummary } from "@/lib/risk-types";
import { getAdvancedProtectionPolicies } from "@/lib/protection/plain-english";

export default function ProtectionAdvancedPanel() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<RiskAnalysisSummary | null>(null);
  const [sourceFilename, setSourceFilename] = useState<string | null>(null);
  const [hasTranslatorSession, setHasTranslatorSession] = useState(false);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const advancedPolicies = useMemo(() => getAdvancedProtectionPolicies(), []);

  const loadAnalysis = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/risk");
      const payload = (await response.json()) as {
        analysis?: RiskAnalysisSummary | null;
        hasTranslatorSession?: boolean;
        sourceFilename?: string | null;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load risk analysis.");
      }

      setData(payload.analysis ?? null);
      setHasTranslatorSession(!!payload.hasTranslatorSession);
      setSourceFilename(payload.sourceFilename ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load risk analysis.");
    } finally {
      setLoading(false);
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      void loadAnalysis();
    }
  }, [open, loadAnalysis]);

  const runAnalysis = async () => {
    setAnalyzing(true);
    setError(null);

    try {
      const response = await fetch("/api/risk", { method: "POST" });
      const payload = (await response.json()) as {
        analysis?: RiskAnalysisSummary;
        sourceFilename?: string | null;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Risk analysis failed.");
      }

      setData(payload.analysis ?? null);
      setSourceFilename(payload.sourceFilename ?? null);
      setHasTranslatorSession(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Risk analysis failed.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleExport = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "risk-analysis-report.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="ds-section prot-advanced">
      <button
        type="button"
        className="prot-advanced-toggle"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <ChevronDown
          className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
          strokeWidth={2}
          aria-hidden="true"
        />
        Advanced
        <span className="text-[var(--ds-text-tertiary)]">
          Technical policies & log analysis
        </span>
      </button>

      {open ? (
        <div className="prot-advanced-panel">
          {error ? (
            <p className="mb-4 text-sm text-red-400" role="alert">
              {error}
            </p>
          ) : null}

          <div className="ds-panel p-6">
            <h3 className="text-sm font-semibold text-[var(--ds-text-primary)]">
              Runtime policy rules
            </h3>
            <p className="mt-1 text-sm text-[var(--ds-text-secondary)]">
              Technical rules evaluated by the gateway when agents propose actions.
            </p>
            <pre className="ab-spec-json mt-4">{JSON.stringify(advancedPolicies, null, 2)}</pre>
          </div>

          <div className="mt-4">
            <SectionHeader
              icon={FileText}
              title="Log analysis"
              description="Optional: analyze translated agent logs for past risks."
              trailing={
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={Download}
                    onClick={handleExport}
                    disabled={!data}
                  >
                    Export
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={RefreshCw}
                    onClick={runAnalysis}
                    loading={analyzing}
                    disabled={!hasTranslatorSession || analyzing || loading}
                  >
                    Re-analyze
                  </Button>
                </>
              }
            />

            <div
              className="defender-banner ds-panel mb-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
              role="note"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--ds-radius-sm)] bg-[var(--ds-brand-muted)]">
                  <FileText
                    className="h-4 w-4 text-[var(--ds-brand)]"
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--ds-text-primary)]">
                    Analysis source: Translated logs from AI Translator
                    {sourceFilename ? ` — ${sourceFilename}` : ""}
                  </p>
                  <p className="mt-0.5 ds-caption">
                    {loading
                      ? "Loading analysis…"
                      : data
                        ? `${data.analyzedLogs} log entries analyzed · Last updated ${new Date(data.lastUpdated).toLocaleString()} · ${data.totalDetected} risks detected`
                        : hasTranslatorSession
                          ? "Translation ready — run risk analysis to generate your report."
                          : "No translated logs yet — translate a log file first."}
                  </p>
                </div>
              </div>
              <Link
                href="/translator"
                className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-[var(--ds-brand)] transition-colors hover:text-[#a5b4fc] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-brand)]"
              >
                View translated logs
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
              </Link>
            </div>

            {loading ? (
              <div className="flex items-center justify-center gap-2 py-24 ds-caption">
                <span className="ds-spinner ds-spinner-lg" aria-hidden="true" />
                Loading risk analysis…
              </div>
            ) : !data ? (
              <div className="ds-panel flex flex-col items-center px-6 py-16 text-center">
                <ShieldAlert
                  className="mb-4 h-10 w-10 text-[var(--ds-brand)]"
                  strokeWidth={1.5}
                />
                <p className="text-base font-medium text-[var(--ds-text-primary)]">
                  {hasTranslatorSession
                    ? "Ready to analyze translated logs"
                    : "No translation data yet"}
                </p>
                <p className="mt-2 max-w-md ds-caption">
                  {hasTranslatorSession
                    ? "Run Gemini risk analysis on your latest AI Translator output. Results are saved to your account."
                    : "Upload and translate a log file in AI Translator, then return here to generate a risk report."}
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  {hasTranslatorSession ? (
                    <Button
                      variant="primary"
                      icon={RefreshCw}
                      onClick={runAnalysis}
                      loading={analyzing}
                    >
                      Analyze risks
                    </Button>
                  ) : (
                    <Link href="/translator">
                      <Button variant="primary">Go to AI Translator</Button>
                    </Link>
                  )}
                </div>
              </div>
            ) : (
              <>
                <section
                  className="ds-section grid grid-cols-1 gap-4 lg:grid-cols-12"
                  aria-label="Risk overview"
                >
                  <div className="lg:col-span-3">
                    <RiskGauge score={data.overallScore} level={data.riskLevel} />
                  </div>

                  <div className="flex flex-col gap-4 lg:col-span-9">
                    <RiskSummaryCards distribution={data.distribution} />
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <RiskPieChart data={data.distribution} />
                      <RiskLineChart data={data.trend} />
                    </div>
                  </div>
                </section>

                <section className="ds-section" aria-label="Detected risks">
                  <SectionHeader
                    icon={AlertTriangle}
                    title="Detected Risks"
                    description="Sorted by severity · Click to expand details"
                    trailing={
                      <span className="ds-badge ds-badge-brand">{data.risks.length}</span>
                    }
                  />

                  <div className="flex flex-col gap-3">
                    {data.risks.map((risk, idx) => (
                      <DetectedRiskCard
                        key={risk.id}
                        risk={risk}
                        defaultExpanded={idx === 0}
                      />
                    ))}
                  </div>
                </section>
              </>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
