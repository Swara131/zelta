"use client";

import { PartyPopper, Shield } from "lucide-react";

interface AgentSetupTrustBannerProps {
  isLive: boolean;
  isComplete?: boolean;
}

export default function AgentSetupTrustBanner({
  isLive,
  isComplete = false,
}: AgentSetupTrustBannerProps) {
  if (isComplete) {
    return (
      <header
        className="asp-banner asp-banner-complete asp-banner-enter"
        role="banner"
      >
        <div className="asp-banner-shield asp-banner-shield-complete" aria-hidden="true">
          <PartyPopper className="asp-banner-party-icon" strokeWidth={1.75} />
        </div>
        <p className="asp-banner-title">🎉 Agent setup complete!</p>
        <span className="asp-banner-status asp-banner-status-live">
          <span className="asp-banner-dot" aria-hidden="true" />
          Live
        </span>
      </header>
    );
  }

  return (
    <header className="asp-banner asp-banner-enter" role="banner">
      <div className="asp-banner-shield" aria-hidden="true">
        <Shield className="asp-banner-shield-icon" strokeWidth={1.75} />
      </div>
      <p className="asp-banner-title">🔒 Your agent is ready and protected</p>
      <span className={`asp-banner-status ${isLive ? "asp-banner-status-live" : ""}`}>
        <span className="asp-banner-dot" aria-hidden="true" />
        {isLive ? "Live" : "Setup in progress"}
      </span>
    </header>
  );
}
