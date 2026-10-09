import { Suspense } from "react";
import TestActionPage from "@/components/safety-check/TestActionPage";

export const metadata = {
  title: "Test an AI Agent Action",
};

export default function TestActionRoute() {
  return (
    <Suspense fallback={null}>
      <TestActionPage />
    </Suspense>
  );
}
