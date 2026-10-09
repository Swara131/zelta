"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { TRUST_TOAST_EVENT, type TrustToastDetail } from "@/lib/trust/dashboard-trust";

export default function TrustToastHost() {
  const [toast, setToast] = useState<TrustToastDetail | null>(null);

  useEffect(() => {
    const handleToast = (event: Event) => {
      const detail = (event as CustomEvent<TrustToastDetail>).detail;
      if (!detail?.message) return;
      setToast(detail);
      window.setTimeout(() => setToast(null), 5200);
    };

    window.addEventListener(TRUST_TOAST_EVENT, handleToast);
    return () => window.removeEventListener(TRUST_TOAST_EVENT, handleToast);
  }, []);

  if (!toast) return null;

  return (
    <div className="trust-toast-host" role="status" aria-live="polite">
      <div className="trust-toast trust-toast-rich ds-toast">
        <p className="trust-toast-message">{toast.message}</p>
        {toast.href && toast.linkLabel ? (
          <Link href={toast.href} className="trust-toast-link">
            {toast.linkLabel}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
