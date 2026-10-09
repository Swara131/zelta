"use client";

interface AgentSetupConfettiProps {
  active: boolean;
}

export default function AgentSetupConfetti({ active }: AgentSetupConfettiProps) {
  if (!active) return null;

  const pieces = Array.from({ length: 14 }, (_, index) => index);

  return (
    <div className="asp-confetti" aria-hidden="true">
      {pieces.map((piece) => (
        <span key={piece} className={`asp-confetti-piece asp-confetti-piece-${piece % 6}`} />
      ))}
    </div>
  );
}
