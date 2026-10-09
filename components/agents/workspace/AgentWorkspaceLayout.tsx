"use client";

import type { ReactNode } from "react";

interface AgentWorkspaceLayoutProps {
  header?: ReactNode;
  contextPanel: ReactNode;
  canvas: ReactNode;
  sidePanel?: ReactNode;
  promptBar?: ReactNode;
  overlay?: ReactNode;
}

export default function AgentWorkspaceLayout({
  header,
  contextPanel,
  canvas,
  sidePanel,
  promptBar,
  overlay,
}: AgentWorkspaceLayoutProps) {
  return (
    <div className="zws-page">
      {header ? <div className="zws-page-header">{header}</div> : null}

      <div className="zws-workspace">
        <div className="zws-workspace-inner">
          {contextPanel}

          <div className="zws-main">
            <div className="zws-main-canvas">{canvas}</div>
            {promptBar ? <div className="zws-main-prompt">{promptBar}</div> : null}
          </div>

          {sidePanel ? <div className="zws-side">{sidePanel}</div> : null}
        </div>

        {overlay ? <div className="zws-overlay">{overlay}</div> : null}
      </div>
    </div>
  );
}
