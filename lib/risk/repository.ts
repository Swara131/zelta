import type { SupabaseClient } from "@supabase/supabase-js";
import { getGroqModel } from "@/lib/groq/env";
import type {
  DetectedRisk,
  RiskDistribution,
  RiskSeverity,
} from "@/lib/risk-types";
import type { RiskAnalysisRecord } from "@/lib/risk/analysis";

export class RiskDbError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RiskDbError";
  }
}

export async function saveRiskAnalysis(
  supabase: SupabaseClient,
  payload: {
    user_id: string;
    organization_id: string;
    uploaded_log_id?: string | null;
    overall_score: number;
    risk_level: RiskSeverity;
    total_detected: number;
    analyzed_logs: number;
    distribution: RiskDistribution[];
    risks: DetectedRisk[];
    model?: string;
  }
): Promise<RiskAnalysisRecord> {
  const { data, error } = await supabase
    .from("risk_analysis")
    .insert({
      organization_id: payload.organization_id,
      user_id: payload.user_id,
      uploaded_log_id: payload.uploaded_log_id ?? null,
      overall_score: payload.overall_score,
      risk_level: payload.risk_level,
      total_detected: payload.total_detected,
      analyzed_logs: payload.analyzed_logs,
      distribution: payload.distribution,
      risks: payload.risks,
      model: payload.model ?? getGroqModel(),
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new RiskDbError(error?.message ?? "Failed to save risk analysis.");
  }

  return data as RiskAnalysisRecord;
}

export async function getLatestRiskAnalysis(
  supabase: SupabaseClient,
  userId: string
): Promise<RiskAnalysisRecord | null> {
  const { data, error } = await supabase
    .from("risk_analysis")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new RiskDbError(error.message);
  }

  return (data as RiskAnalysisRecord | null) ?? null;
}

export async function listRiskAnalysesForTrend(
  supabase: SupabaseClient,
  userId: string,
  limit = 7
): Promise<RiskAnalysisRecord[]> {
  const { data, error } = await supabase
    .from("risk_analysis")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new RiskDbError(error.message);
  }

  return ((data as RiskAnalysisRecord[]) ?? []).reverse();
}

export async function getSourceFilenameForAnalysis(
  supabase: SupabaseClient,
  uploadedLogId: string | null
): Promise<string | null> {
  if (!uploadedLogId) {
    return null;
  }

  const { data, error } = await supabase
    .from("uploaded_logs")
    .select("filename")
    .eq("id", uploadedLogId)
    .maybeSingle();

  if (error) {
    throw new RiskDbError(error.message);
  }

  return data?.filename ?? null;
}

/** @deprecated Legacy translator_sessions — kept for backward-compatible reads only. */
export async function saveTranslatorSession(
  supabase: SupabaseClient,
  userId: string,
  logContent: string,
  translations: import("@/lib/translator-types").TranslatedAction[],
  filename?: string | null
) {
  const { data, error } = await supabase
    .from("translator_sessions")
    .insert({
      user_id: userId,
      filename: filename ?? null,
      log_content: logContent,
      translations,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new RiskDbError(error?.message ?? "Failed to save translator session.");
  }

  return data;
}

/** @deprecated Legacy translator_sessions — kept for backward-compatible reads only. */
export async function getLatestTranslatorSession(
  supabase: SupabaseClient,
  userId: string
) {
  const { data, error } = await supabase
    .from("translator_sessions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new RiskDbError(error.message);
  }

  return data ?? null;
}
