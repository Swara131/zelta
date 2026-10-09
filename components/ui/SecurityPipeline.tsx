const DEFAULT_STEPS = [
  "Your AI agent",
  "Wave gateway",
  "Policy check",
  "Risk analysis",
  "Approve / Block / Allow",
  "Execution token",
  "Action",
] as const;

interface SecurityPipelineProps {
  steps?: readonly string[];
  compact?: boolean;
  className?: string;
}

export default function SecurityPipeline({
  steps = DEFAULT_STEPS,
  compact = false,
  className = "",
}: SecurityPipelineProps) {
  return (
    <div
      className={`sp-pipeline ${compact ? "sp-pipeline-compact" : ""} ${className}`.trim()}
      aria-label="How Wave protects agent actions"
    >
      {steps.map((step, index) => (
        <div key={`${step}-${index}`} className="sp-step-wrap">
          <p
            className={`sp-step ${index === 1 ? "sp-step-brand" : ""} ${index === steps.length - 1 ? "sp-step-final" : ""}`}
          >
            {step.toUpperCase() === step && step.length < 20 ? step : step}
          </p>
          {index < steps.length - 1 ? (
            <span className="sp-arrow" aria-hidden="true">
              ↓
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}
