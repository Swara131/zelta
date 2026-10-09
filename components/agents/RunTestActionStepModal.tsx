"use client";

import TemplateSimulationModal from "@/components/agents/setup/TemplateSimulationModal";

interface RunTestActionStepModalProps {
  open: boolean;
  agentId: string;
  agentName: string;
  templateSlug?: string | null;
  onClose: () => void;
  onTestPassed: () => void;
}

/** Setup checklist “Run Test” — template-specific sandbox, does not auto-close. */
export default function RunTestActionStepModal({
  open,
  agentId,
  agentName,
  templateSlug,
  onClose,
  onTestPassed,
}: RunTestActionStepModalProps) {
  return (
    <TemplateSimulationModal
      open={open}
      agentId={agentId}
      agentName={agentName}
      templateSlug={templateSlug}
      onClose={onClose}
      onCompleted={onTestPassed}
    />
  );
}
