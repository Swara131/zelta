import { NextResponse } from "next/server";
import {
  AiRiskAnalysisError,
  analyzeRiskWithGroq,
} from "@/lib/groq/analyze-risk";
import { getGroqModel } from "@/lib/groq/env";
import { generateApprovalsFromRiskAnalysis } from "@/lib/approvals/engine";
import { notifyCriticalRiskDetected } from "@/lib/email/service";
import { toRiskAnalysisSummary } from "@/lib/risk/analysis";
import {
  RiskDbError,
  getLatestRiskAnalysis,
  getSourceFilenameForAnalysis,
  listRiskAnalysesForTrend,
  saveRiskAnalysis,
} from "@/lib/risk/repository";
import {
  getLatestTranslationBatch,
  resolveOrganizationId,
} from "@/lib/translations/repository";
import { TranslationDbError } from "@/lib/translations/errors";
import { recordAudit } from "@/lib/audit/logger";
import {
  billingErrorResponse,
  getBillingContext,
  requireFeatureAccess,
} from "@/lib/billing/guards";
import { assertUsageCapacity } from "@/lib/billing/usage";
import { createClient } from "@/lib/supabase/server";

function errorStatus(err: unknown): number {
  if (err instanceof Error && err.message.includes("Missing environment variable")) {
    return 503;
  }
  if (
    err instanceof TranslationDbError ||
    (err instanceof Error &&
      (err.message.includes("No translated") ||
        err.message.includes("not found")))
  ) {
    return 404;
  }
  return 500;
}

async function resolveSourceFilename(
  supabase: Awaited<ReturnType<typeof createClient>>,
  analysis: { uploaded_log_id: string | null } | null,
  batchFilename: string | null
): Promise<string | null> {
  if (analysis?.uploaded_log_id) {
    return getSourceFilenameForAnalysis(supabase, analysis.uploaded_log_id);
  }
  return batchFilename;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [latestAnalysis, translationBatch, trendRecords] = await Promise.all([
      getLatestRiskAnalysis(supabase, user.id),
      getLatestTranslationBatch(supabase, user.id),
      listRiskAnalysesForTrend(supabase, user.id, 7),
    ]);

    const hasTranslatorSession = !!translationBatch?.translations.length;
    const sourceFilename = await resolveSourceFilename(
      supabase,
      latestAnalysis,
      translationBatch?.sourceFilename ?? null
    );

    if (!latestAnalysis) {
      return NextResponse.json({
        analysis: null,
        hasTranslatorSession,
        sourceFilename,
      });
    }

    return NextResponse.json({
      analysis: toRiskAnalysisSummary(latestAnalysis, trendRecords),
      hasTranslatorSession,
      sourceFilename,
    });
  } catch (err) {
    const message =
      err instanceof RiskDbError || err instanceof TranslationDbError
        ? err.message
        : "Failed to load risk analysis.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const billing = await getBillingContext(
      supabase,
      user.id,
      user.email ?? "user@local"
    );
    await requireFeatureAccess(billing, "advancedRisk");
    await assertUsageCapacity(
      supabase,
      billing.organizationId,
      billing.subscription,
      "apiCalls"
    );
  } catch (err) {
    const { status, body } = billingErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  try {
    const batch = await getLatestTranslationBatch(supabase, user.id);

    if (!batch?.translations.length) {
      return NextResponse.json(
        {
          error:
            "No translated logs found. Run AI Translator first, then analyze risks.",
        },
        { status: 404 }
      );
    }

    const aiResult = await analyzeRiskWithGroq(batch.translations);

    const organizationId = await resolveOrganizationId(
      supabase,
      user.id,
      user.email ?? "user@local",
      batch.organizationId
    );

    const saved = await saveRiskAnalysis(supabase, {
      user_id: user.id,
      organization_id: organizationId,
      uploaded_log_id: batch.uploadedLogId,
      overall_score: aiResult.overallScore,
      risk_level: aiResult.riskLevel,
      total_detected: aiResult.totalDetected,
      analyzed_logs: aiResult.analyzedLogs,
      distribution: aiResult.distribution,
      risks: aiResult.risks,
      model: getGroqModel(),
    });

    const trendRecords = await listRiskAnalysesForTrend(supabase, user.id, 7);

    try {
      await generateApprovalsFromRiskAnalysis(supabase, {
        organizationId: organizationId,
        requesterId: user.id,
        riskAnalysisId: saved.id,
        risks: aiResult.risks,
      });
    } catch (approvalErr) {
      console.error("Approval engine failed after risk analysis:", approvalErr);
    }

    const criticalRisks = aiResult.risks.filter(
      (risk) => risk.severity === "critical"
    );

    for (const risk of criticalRisks) {
      try {
        await notifyCriticalRiskDetected(supabase, {
          organizationId,
          userId: user.id,
          riskAnalysisId: saved.id,
          risk,
          overallScore: aiResult.overallScore,
        });
      } catch (emailErr) {
        console.error("Critical risk email failed:", emailErr);
      }
    }

    await recordAudit(supabase, {
      request,
      userId: user.id,
      organizationId,
      action: "analyze",
      entityType: "risk_analysis",
      entityId: saved.id as string,
      riskSeverity: aiResult.riskLevel,
      approvalStatus: null,
      metadata: {
        description: `Risk analysis completed — score ${aiResult.overallScore}/100, ${aiResult.totalDetected} risks detected`,
        overallScore: aiResult.overallScore,
        totalDetected: aiResult.totalDetected,
        sourceFilename: batch.sourceFilename,
      },
    });

    return NextResponse.json({
      analysis: toRiskAnalysisSummary(saved, trendRecords),
      sourceFilename: batch.sourceFilename,
    });
  } catch (err) {
    const message =
      err instanceof AiRiskAnalysisError
        ? err.message
        : err instanceof RiskDbError
          ? err.message
          : err instanceof TranslationDbError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Risk analysis failed.";

    return NextResponse.json({ error: message }, { status: errorStatus(err) });
  }
}
