"use client";

import Link from "next/link";
import { AGENT_CONNECTION_OPTIONS } from "@/lib/agents/platform/connection-options";

interface ConnectAgentPanelProps {
  onClose: () => void;
}

export default function ConnectAgentPanel({ onClose }: ConnectAgentPanelProps) {
  return (
    <section className="zplat-connect ds-panel" aria-labelledby="zplat-connect-heading">
      <div className="zplat-connect-header">
        <h2 id="zplat-connect-heading">How was your agent built?</h2>
        <button type="button" className="zplat-btn zplat-btn-ghost" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="zplat-connect-lead">
        Wave will not mark an external agent as connected until a real connection test succeeds.
      </p>
      <ul className="zplat-connect-grid">
        {AGENT_CONNECTION_OPTIONS.map((option) => (
          <li key={option.id}>
            <Link href={option.href} className="zplat-connect-card">
              <h3>{option.title}</h3>
              <p>{option.description}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
