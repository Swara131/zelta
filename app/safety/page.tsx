import { Suspense } from "react";
import SafetyCenterPage from "@/components/safety/SafetyCenterPage";

export default function SafetyCenterRoute() {
  return (
    <Suspense fallback={null}>
      <SafetyCenterPage />
    </Suspense>
  );
}
