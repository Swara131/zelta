import Link from "next/link";

interface HomeHeroProps {
  protectedCount: number;
}

export default function HomeHero({ protectedCount }: HomeHeroProps) {
  const badgeText =
    protectedCount === 1
      ? "1 agent protected"
      : `${protectedCount} agents protected`;

  return (
    <header className="zhome-hero" aria-labelledby="zhome-hero-title">
      <div className="zhome-hero-content">
        <div className="zhome-hero-copy">
          <span className="zhome-hero-badge">{badgeText}</span>
          <h1 id="zhome-hero-title" className="zhome-hero-title">
            Build, run and protect AI agents with Wave.
          </h1>
          <p className="zhome-hero-desc">
            Create production agents, test them live, pause risky actions for approval,
            then deploy with safety controls in place.
          </p>
          <nav className="zhome-flow" aria-label="Agent lifecycle">
            <span className="zhome-flow-step">Build</span>
            <span aria-hidden="true">→</span>
            <span className="zhome-flow-step">Test</span>
            <span aria-hidden="true">→</span>
            <span className="zhome-flow-step">Understand</span>
            <span aria-hidden="true">→</span>
            <span className="zhome-flow-step">Protect</span>
            <span aria-hidden="true">→</span>
            <span className="zhome-flow-step">Approve</span>
            <span aria-hidden="true">→</span>
            <span className="zhome-flow-step">Deploy</span>
            <span aria-hidden="true">→</span>
            <span className="zhome-flow-step">Monitor</span>
          </nav>
        </div>
        <div className="zhome-hero-actions">
          <Link href="/agents/create" className="zhome-create-btn">
            Create Agent
          </Link>
          <Link
            href="/agents/platform?connect=1"
            className="zhome-create-btn zhome-create-btn-secondary"
          >
            Connect Agent
          </Link>
          <Link
            href="/agents/platform?test=1"
            className="zhome-create-btn zhome-create-btn-secondary"
          >
            Test Agent
          </Link>
        </div>
      </div>
    </header>
  );
}
