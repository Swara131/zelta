import EmailDecisionResultPage from "@/components/approvals/EmailDecisionResultPage";
import { processEmailApprovalAction } from "@/lib/gateway/email-approval/process-action";

export const dynamic = "force-dynamic";

export default async function DenyFromEmailPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await processEmailApprovalAction(token, "deny");
  return <EmailDecisionResultPage result={result} />;
}
