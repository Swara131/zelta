export default function ProtectionFlowDiagram() {
  return (
    <section className="prot-flow-panel ds-panel" aria-labelledby="prot-flow-heading">
      <h2 id="prot-flow-heading" className="sr-only">
        How an agent action is evaluated
      </h2>

      <div className="prot-flow-diagram">
        <div className="prot-flow-step">
          <span className="prot-flow-step-label">AI Agent</span>
        </div>

        <span className="prot-flow-arrow" aria-hidden="true">
          ↓
        </span>

        <div className="prot-flow-step">
          <span className="prot-flow-step-label">Action Request</span>
        </div>

        <span className="prot-flow-arrow" aria-hidden="true">
          ↓
        </span>

        <div className="prot-flow-step prot-flow-step-check">
          <span className="prot-flow-step-label">Wave Policy + Risk Check</span>
        </div>

        <span className="prot-flow-arrow" aria-hidden="true">
          ↓
        </span>

        <div className="prot-flow-outcomes" role="list" aria-label="Possible outcomes">
          <div className="prot-flow-outcome prot-decision-allow" role="listitem">
            <p className="prot-flow-outcome-name">Allow</p>
            <p className="prot-flow-outcome-desc">Automatic</p>
          </div>
          <div className="prot-flow-outcome prot-decision-review" role="listitem">
            <p className="prot-flow-outcome-name">Approval</p>
            <p className="prot-flow-outcome-desc">Human review</p>
          </div>
          <div className="prot-flow-outcome prot-decision-block" role="listitem">
            <p className="prot-flow-outcome-name">Block</p>
            <p className="prot-flow-outcome-desc">Never allowed</p>
          </div>
        </div>
      </div>
    </section>
  );
}
