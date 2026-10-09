interface WorkflowStepProps {
  icon: string;
  title: string;
  description?: string;
  lines?: string[];
  tone?: "blue" | "purple" | "green" | "orange" | "success" | "warning" | "neutral";
  index: number;
  showArrow?: boolean;
  pulse?: boolean;
  checkmark?: boolean;
}

const TONE_CLASS: Record<NonNullable<WorkflowStepProps["tone"]>, string> = {
  blue: "awf-step-blue",
  purple: "awf-step-purple",
  green: "awf-step-green",
  orange: "awf-step-orange",
  success: "awf-step-success",
  warning: "awf-step-warning",
  neutral: "awf-step-neutral",
};

export default function WorkflowStep({
  icon,
  title,
  description,
  lines,
  tone = "neutral",
  index,
  showArrow = true,
  pulse = false,
  checkmark = false,
}: WorkflowStepProps) {
  return (
    <div
      className="awf-step-wrap"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <div
        className={`awf-step ${TONE_CLASS[tone]}${pulse ? " awf-step-pulse" : ""}`}
      >
        {checkmark ? (
          <span className="awf-step-check" aria-hidden="true">
            ✓
          </span>
        ) : null}
        <span className="awf-step-icon" aria-hidden="true">
          {icon}
        </span>
        <p className="awf-step-title">{title}</p>
        {description ? <p className="awf-step-desc">{description}</p> : null}
        {lines?.map((line) => (
          <p key={line} className="awf-step-line">
            {line}
          </p>
        ))}
      </div>
      {showArrow ? (
        <div className="awf-arrow" aria-hidden="true">
          ↓
        </div>
      ) : null}
    </div>
  );
}
