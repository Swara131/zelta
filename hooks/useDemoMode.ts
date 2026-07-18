"use client";

import { useEffect, useState } from "react";

let cachedEnabled: boolean | null = null;
let pendingRequest: Promise<boolean> | null = null;

/** Loads demo mode from the server API (DEMO_MODE env is not available in the browser). */
export async function fetchDemoModeEnabled(): Promise<boolean> {
  if (cachedEnabled !== null) {
    return cachedEnabled;
  }

  if (!pendingRequest) {
    pendingRequest = fetch("/api/demo-mode", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return false;
        const payload = (await response.json()) as { enabled?: boolean };
        return Boolean(payload.enabled);
      })
      .catch(() => false)
      .then((enabled) => {
        cachedEnabled = enabled;
        return enabled;
      });
  }

  return pendingRequest;
}

export function useDemoMode(): { demoMode: boolean; loading: boolean } {
  const [demoMode, setDemoMode] = useState(cachedEnabled ?? false);
  const [loading, setLoading] = useState(cachedEnabled === null);

  useEffect(() => {
    void fetchDemoModeEnabled().then((enabled) => {
      setDemoMode(enabled);
      setLoading(false);
    });
  }, []);

  return { demoMode, loading };
}
