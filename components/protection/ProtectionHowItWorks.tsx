export default function ProtectionHowItWorks() {
  return (
    <section className="prot-hero ds-panel" aria-labelledby="prot-hero-title">
      <h2 id="prot-hero-title" className="prot-hero-title">
        How Wave protects your agent
      </h2>
      <p className="prot-hero-lead">
        Before an AI agent performs an important action, Wave checks its policy and risk level and
        decides whether to allow, pause, or block it.
      </p>

      <div className="prot-flow-visual" aria-label="How Wave evaluates agent actions">
        <div className="prot-flow-step-box">
          <span className="prot-flow-step-label">AI AGENT</span>
        </div>
        <span className="prot-flow-arrow" aria-hidden="true">
          ↓
        </span>
        <div className="prot-flow-step-box">
          <span className="prot-flow-step-label">ACTION REQUEST</span>
        </div>
        <span className="prot-flow-arrow" aria-hidden="true">
          ↓
        </span>
        <div className="prot-flow-step-box prot-flow-step-check">
          <span className="prot-flow-step-label">WAVE POLICY + RISK CHECK</span>
        </div>
        <span className="prot-flow-arrow" aria-hidden="true">
          ↓
        </span>
        <div className="prot-flow-outcomes">
          <div className="prot-flow-outcome prot-flow-outcome-allow">
            <span className="prot-flow-outcome-name">ALLOW</span>
            <span className="prot-flow-outcome-desc">Automatic</span>
          </div>
          <div className="prot-flow-outcome prot-flow-outcome-review">
            <span className="prot-flow-outcome-name">APPROVAL</span>
            <span className="prot-flow-outcome-desc">Human review</span>
          </div>
          <div className="prot-flow-outcome prot-flow-outcome-block">
            <span className="prot-flow-outcome-name">BLOCK</span>
            <span className="prot-flow-outcome-desc">Never allowed</span>
          </div>
        </div>
      </div>
    </section>
  );
}
