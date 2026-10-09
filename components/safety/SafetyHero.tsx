import { Shield } from "lucide-react";

export default function SafetyHero() {
  return (
    <header className="sc-hero" aria-labelledby="sc-hero-title">
      <div className="sc-hero-content">
        <div className="sc-hero-icon-wrap" aria-hidden="true">
          <Shield className="sc-hero-icon" strokeWidth={1.75} />
        </div>
        <div className="sc-hero-copy">
          <p className="sc-hero-kicker">Control center</p>
          <h1 id="sc-hero-title" className="sc-hero-title">
            Safety
          </h1>
          <p className="sc-hero-desc">
            See what is protected, what needs review, and which policies pause
            high-risk agent actions before they run.
          </p>
        </div>
      </div>
    </header>
  );
}
