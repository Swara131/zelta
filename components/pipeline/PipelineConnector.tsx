"use client";

interface PipelineConnectorProps {
  index: number;
  gradient: string;
  isFlowing: boolean;
}

export default function PipelineConnector({
  index,
  gradient,
  isFlowing,
}: PipelineConnectorProps) {
  return (
    <div
      className="pipeline-connector flex flex-col items-center py-1"
      style={{ animationDelay: `${index * 120 + 60}ms` }}
      aria-hidden="true"
    >
      <div className="relative flex h-12 w-px items-center justify-center">
        {/* Static line */}
        <div className="absolute inset-y-0 w-px bg-white/10" />

        {/* Animated flow line */}
        <div
          className={`absolute inset-y-0 w-px bg-gradient-to-b ${gradient} transition-opacity duration-500 ${
            isFlowing ? "opacity-100" : "opacity-30"
          }`}
        />

        {/* Flowing particle */}
        {isFlowing && (
          <div className={`pipeline-flow-dot bg-gradient-to-b ${gradient}`} />
        )}
      </div>

      {/* Chevron */}
      <svg
        width="16"
        height="10"
        viewBox="0 0 16 10"
        className={`text-zinc-600 transition-colors ${isFlowing ? "text-zinc-400" : ""}`}
      >
        <path
          d="M2 2l6 6 6-6"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
