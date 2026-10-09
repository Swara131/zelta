"use client";

import { useState } from "react";
import { Shield } from "lucide-react";
import PageShell from "@/components/ui/PageShell";
import PageHeader from "@/components/ui/PageHeader";
import { PageHeaderBadges } from "@/components/ui/DemoModeBadge";
import ProtectionFlowDiagram from "./ProtectionFlowDiagram";
import PolicyLearningPanel from "./PolicyLearningPanel";
import ProtectionRulesTable from "./ProtectionRulesTable";
import ProtectionRuleTester from "./ProtectionRuleTester";
import ProtectionAdvancedPanel from "./ProtectionAdvancedPanel";

export default function ProtectionPage() {
  const [rulesVersion, setRulesVersion] = useState(0);

  return (
    <PageShell maxWidth="6xl" className="prot-page">
      <PageHeader
        icon={Shield}
        title="How Wave protects your agent"
        description="Before an AI agent performs an important action, Wave checks its policy and risk level and decides whether to allow, pause, or block it."
        badge={<PageHeaderBadges />}
      />

      <ProtectionFlowDiagram />

      <PolicyLearningPanel onRulesApplied={() => setRulesVersion((value) => value + 1)} />

      <ProtectionRulesTable key={rulesVersion} />

      <ProtectionRuleTester />

      <ProtectionAdvancedPanel />
    </PageShell>
  );
}
