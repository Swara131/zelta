import { ArrowDown, CheckCircle2 } from "lucide-react";
import { ZELTA_DEMO_AGENT_NAME } from "@/lib/dashboard/zelta-demo-scenario";
import { getLargeRefundThresholdLabel } from "@/lib/protection/founder-copy";

export default function ProtectionExampleFlow() {
  const refundLimit = getLargeRefundThresholdLabel();

  return (
    <div className="prot-example-flow">
      <div className="prot-example-step">
        <span className="prot-example-label">AI Agent</span>
        <p className="prot-example-value">&ldquo;{ZELTA_DEMO_AGENT_NAME}&rdquo;</p>
      </div>

      <ArrowDown className="prot-example-arrow" strokeWidth={2} aria-hidden="true" />

      <div className="prot-example-step">
        <span className="prot-example-label">Wants to</span>
        <p className="prot-example-value">&ldquo;Refund ₹50,000&rdquo;</p>
      </div>

      <ArrowDown className="prot-example-arrow" strokeWidth={2} aria-hidden="true" />

      <div className="prot-example-step prot-example-step-check">
        <span className="prot-example-label">Wave checks</span>
        <p className="prot-example-value">
          &ldquo;Refund limit: {refundLimit}&rdquo;
        </p>
      </div>

      <ArrowDown className="prot-example-arrow" strokeWidth={2} aria-hidden="true" />

      <div className="prot-example-step prot-example-step-review">
        <span className="prot-example-label">Decision</span>
        <p className="prot-example-decision">Review required</p>
      </div>

      <ArrowDown className="prot-example-arrow" strokeWidth={2} aria-hidden="true" />

      <div className="prot-example-step prot-example-step-result">
        <CheckCircle2 className="h-5 w-5 text-emerald-400" strokeWidth={2} aria-hidden="true" />
        <p className="prot-example-outcome">Human approves → action continues</p>
      </div>
    </div>
  );
}
