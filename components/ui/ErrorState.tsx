"use client";

import Link from "next/link";
import { useState } from "react";

export default function ErrorState({
  title,
  description,
  fixLabel,
  fixHref,
  onFix,
  technical,
}: {
  title: string;
  description?: string;
  fixLabel?: string;
  fixHref?: string;
  onFix?: () => void;
  technical?: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="ds-error-state ds-panel" role="alert">
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
      {fixHref || onFix ? (
        <div className="ds-error-actions">
          {fixHref ? (
            <Link href={fixHref} className="ds-btn ds-btn-primary">
              {fixLabel ?? "Fix connection"}
            </Link>
          ) : null}
          {onFix ? (
            <button type="button" className="ds-btn ds-btn-secondary" onClick={onFix}>
              {fixLabel ?? "Try again"}
            </button>
          ) : null}
        </div>
      ) : null}
      {technical ? (
        <div className="ds-error-technical">
          <button type="button" className="ds-btn ds-btn-ghost" onClick={() => setOpen((v) => !v)}>
            {open ? "Hide technical details" : "Technical details"}
          </button>
          {open ? <pre>{technical}</pre> : null}
        </div>
      ) : null}
    </div>
  );
}
