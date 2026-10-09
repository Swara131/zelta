export default function MyAgentsHero() {
  return (
    <header className="ma-hero" aria-labelledby="ma-hero-title">
      <div className="ma-hero-gradient" aria-hidden="true" />
      <div className="ma-hero-pattern" aria-hidden="true" />
      <span className="ma-hero-deco" aria-hidden="true">
        🤖
      </span>

      <div className="ma-hero-content">
        <h1 id="ma-hero-title" className="ma-hero-title">
          My AI Agents
        </h1>
        <p className="ma-hero-desc">
          Build and use agents in Wave, or connect an existing agent to the protection gateway.
        </p>
      </div>
    </header>
  );
}
