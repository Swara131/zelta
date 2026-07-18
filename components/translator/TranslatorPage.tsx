"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import PageShell from "@/components/ui/PageShell";
import PageHeader from "@/components/ui/PageHeader";
import PlanUpgradeNotice, { isPlanRequiredMessage } from "@/components/ui/PlanUpgradeNotice";
import { hasFeature } from "@/lib/billing/plans";
import type { PlanId } from "@/lib/billing-types";
import TranslatorUploadArea from "./TranslatorUploadArea";
import TechnicalLogPanel from "./TechnicalLogPanel";
import TranslationPanel from "./TranslationPanel";
import {
  formatTranslationsForCopy,
  formatTranslationsForDownload,
} from "@/lib/dummy-translation";
import type {
  TranslatedAction,
  TranslatorStatus,
  UploadedLogSummary,
} from "@/lib/translator-types";

const CARD_REVEAL_DELAY = 500;
const INITIAL_TYPING_DELAY = 400;

async function fetchUploadedLogs(): Promise<UploadedLogSummary[]> {
  const response = await fetch("/api/translator/uploads");
  const data = (await response.json()) as {
    uploads?: UploadedLogSummary[];
    error?: string;
  };

  if (!response.ok) {
    throw new Error(data.error ?? "Failed to load uploaded logs.");
  }

  return data.uploads ?? [];
}

async function fetchUploadedLog(uploadedLogId: string): Promise<{
  filename: string;
  logContent: string;
  translations: TranslatedAction[];
  cached: boolean;
}> {
  const response = await fetch(
    `/api/translator?uploadedLogId=${encodeURIComponent(uploadedLogId)}`
  );
  const data = (await response.json()) as {
    filename?: string;
    logContent?: string;
    translations?: TranslatedAction[];
    cached?: boolean;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(data.error ?? "Failed to load uploaded log.");
  }

  return {
    filename: data.filename ?? "uploaded-log",
    logContent: data.logContent ?? "",
    translations: data.translations ?? [],
    cached: data.cached ?? false,
  };
}

async function fetchTranslations(params: {
  logContent?: string;
  filename?: string | null;
  uploadedLogId?: string | null;
}): Promise<TranslatedAction[]> {
  const response = await fetch("/api/translator", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  const data = (await response.json()) as {
    translations?: TranslatedAction[];
    error?: string;
  };

  if (!response.ok) {
    throw new Error(data.error ?? "Translation request failed.");
  }

  if (!data.translations?.length) {
    throw new Error("No translations were returned.");
  }

  return data.translations;
}

export default function TranslatorPage() {
  const [logContent, setLogContent] = useState("");
  const [filename, setFilename] = useState<string | null>(null);
  const [uploadedLogId, setUploadedLogId] = useState<string | null>(null);
  const [uploads, setUploads] = useState<UploadedLogSummary[]>([]);
  const [loadingUploads, setLoadingUploads] = useState(true);
  const [loadingLog, setLoadingLog] = useState(false);
  const [status, setStatus] = useState<TranslatorStatus>("idle");
  const [translations, setTranslations] = useState<TranslatedAction[]>([]);
  const [visibleCount, setVisibleCount] = useState(0);
  const [typingIndex, setTypingIndex] = useState(-1);
  const [activeLine, setActiveLine] = useState<number | undefined>();
  const [translateError, setTranslateError] = useState<string | null>(null);
  const [translatorLocked, setTranslatorLocked] = useState(false);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingIndexRef = useRef(-1);
  const translationsRef = useRef<TranslatedAction[]>([]);

  useEffect(() => {
    typingIndexRef.current = typingIndex;
  }, [typingIndex]);

  const clearTimers = () => {
    if (revealTimer.current) clearTimeout(revealTimer.current);
  };

  const beginRevealAnimation = useCallback((items: TranslatedAction[]) => {
    translationsRef.current = items;
    setTranslations(items);
    setVisibleCount(0);
    setTypingIndex(-1);
    setActiveLine(undefined);

    revealTimer.current = setTimeout(() => {
      setVisibleCount(1);
      setTypingIndex(0);
      setActiveLine(items[0]?.lineNumber);
    }, INITIAL_TYPING_DELAY);
  }, []);

  const showCachedTranslations = useCallback(
    (items: TranslatedAction[]) => {
      translationsRef.current = items;
      setTranslations(items);
      setVisibleCount(items.length);
      setTypingIndex(-1);
      setActiveLine(items[items.length - 1]?.lineNumber);
      setStatus("complete");
    },
    []
  );

  useEffect(() => {
    fetchUploadedLogs()
      .then(setUploads)
      .catch((err) => {
        setTranslateError(
          err instanceof Error ? err.message : "Failed to load uploaded logs."
        );
      })
      .finally(() => setLoadingUploads(false));
  }, []);

  useEffect(() => {
    fetch("/api/billing")
      .then(async (response) => {
        const data = (await response.json()) as {
          currentPlan?: PlanId;
          error?: string;
        };
        if (response.ok && data.currentPlan) {
          setTranslatorLocked(!hasFeature(data.currentPlan, "translator"));
        }
      })
      .catch(() => {
        /* billing lookup optional for UI hint */
      });
  }, []);

  const startTranslation = useCallback(async () => {
    clearTimers();
    setTranslateError(null);
    setStatus("translating");
    setTranslations([]);
    setVisibleCount(0);
    setTypingIndex(-1);
    setActiveLine(undefined);

    try {
      const items = await fetchTranslations({
        logContent: uploadedLogId ? undefined : logContent,
        filename,
        uploadedLogId,
      });
      beginRevealAnimation(items);

      if (uploadedLogId) {
        setUploads((prev) =>
          prev.map((upload) =>
            upload.id === uploadedLogId ? { ...upload, hasTranslations: true } : upload
          )
        );
      }
    } catch (err) {
      setStatus("idle");
      const message =
        err instanceof Error ? err.message : "Translation failed. Please try again.";
      if (isPlanRequiredMessage(message)) {
        setTranslatorLocked(true);
        setTranslateError(null);
      } else {
        setTranslateError(message);
      }
    }
  }, [logContent, filename, uploadedLogId, beginRevealAnimation]);

  const handleTypingComplete = useCallback(() => {
    const next = typingIndexRef.current + 1;
    const items = translationsRef.current;

    if (next < items.length) {
      revealTimer.current = setTimeout(() => {
        setVisibleCount(next + 1);
        setTypingIndex(next);
        setActiveLine(items[next].lineNumber);
      }, CARD_REVEAL_DELAY);
    } else {
      setTypingIndex(-1);
      setStatus("complete");
    }
  }, []);

  const handleFileLoad = (content: string, name: string) => {
    clearTimers();
    setLogContent(content);
    setFilename(name);
    setUploadedLogId(null);
    setStatus("idle");
    setTranslations([]);
    setVisibleCount(0);
    setTypingIndex(-1);
    setActiveLine(undefined);
    setTranslateError(null);
  };

  const handleUploadSelect = async (uploadId: string) => {
    clearTimers();
    setTranslateError(null);
    setLoadingLog(true);
    setUploadedLogId(uploadId);
    setStatus("idle");
    setTranslations([]);
    setVisibleCount(0);
    setTypingIndex(-1);
    setActiveLine(undefined);

    try {
      const result = await fetchUploadedLog(uploadId);
      setLogContent(result.logContent);
      setFilename(result.filename);

      if (result.cached && result.translations.length > 0) {
        showCachedTranslations(result.translations);
      }
    } catch (err) {
      setLogContent("");
      setFilename(null);
      setUploadedLogId(null);
      const message =
        err instanceof Error ? err.message : "Failed to load uploaded log.";
      if (isPlanRequiredMessage(message)) {
        setTranslatorLocked(true);
        setTranslateError(null);
      } else {
        setTranslateError(message);
      }
    } finally {
      setLoadingLog(false);
    }
  };

  const handleTranslate = () => {
    if (logContent && !loadingLog) startTranslation();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(formatTranslationsForCopy(translations));
  };

  const handleDownload = () => {
    const blob = new Blob([formatTranslationsForDownload(translations)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename?.replace(/\.[^.]+$/, "") ?? "translation"}-plain-english.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRegenerate = () => startTranslation();

  const handleTranslateAgain = () => {
    clearTimers();
    setStatus("idle");
    setTranslations([]);
    setVisibleCount(0);
    setTypingIndex(-1);
    setActiveLine(undefined);
    setLogContent("");
    setFilename(null);
    setUploadedLogId(null);
    setTranslateError(null);
  };

  return (
    <PageShell>
      <PageHeader
        icon={Sparkles}
        title="AI Translator"
        description="Convert complex agent action logs into clear, business-readable explanations. Powered by AI with confidence scoring and impact analysis."
      />

      <section className="ds-section fade-in-up" style={{ animationDelay: "0.05s" }}>
        <TranslatorUploadArea
          filename={filename}
          onFileLoad={handleFileLoad}
          onTranslate={handleTranslate}
          isTranslating={status === "translating"}
          hasContent={!!logContent}
          uploads={uploads}
          selectedUploadId={uploadedLogId}
          onUploadSelect={handleUploadSelect}
          loadingUploads={loadingUploads}
          loadingLog={loadingLog}
          planLocked={translatorLocked}
        />
        {translatorLocked ? (
          <PlanUpgradeNotice featureLabel="AI Translator" requiredPlan="Professional" />
        ) : (
          translateError && (
            <p className="mt-3 text-sm text-red-400" role="alert">
              {translateError}
            </p>
          )
        )}
      </section>

      <section
        className="fade-in-up grid min-h-[560px] grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-0"
        style={{ animationDelay: "0.1s" }}
        aria-label="Log translation workspace"
      >
        <div className="ds-panel overflow-hidden lg:rounded-r-none lg:border-r-0">
          <TechnicalLogPanel content={logContent} activeLine={activeLine} />
        </div>

        <div className="ds-panel overflow-hidden lg:rounded-l-none">
          <TranslationPanel
            status={status}
            translations={translations}
            visibleCount={visibleCount}
            typingIndex={typingIndex}
            onTypingComplete={handleTypingComplete}
            onCopy={handleCopy}
            onDownload={handleDownload}
            onRegenerate={handleRegenerate}
            onTranslateAgain={handleTranslateAgain}
          />
        </div>
      </section>
    </PageShell>
  );
}
