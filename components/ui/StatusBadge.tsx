type StatusTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "pending";

const TONE_CLASS: Record<StatusTone, string> = {
  neutral: "ds-badge ds-badge-neutral",
  info: "ds-badge ds-badge-brand",
  success: "ds-badge ds-badge-success",
  warning: "ds-badge ds-badge-warning",
  danger: "ds-badge ds-badge-danger",
  pending: "ds-badge ds-badge-pending",
};

export default function StatusBadge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: StatusTone;
}) {
  return <span className={TONE_CLASS[tone]}>{children}</span>;
}
