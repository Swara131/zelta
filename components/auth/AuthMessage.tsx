interface AuthMessageProps {
  type: "error" | "success" | "info";
  message: string;
}

const STYLES = {
  error: "border-red-500/25 bg-red-500/10 text-red-300",
  success: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
  info: "border-[var(--ds-brand-ring)] bg-[var(--ds-brand-muted)] text-[#a5b4fc]",
};

export default function AuthMessage({ type, message }: AuthMessageProps) {
  return (
    <div
      className={`rounded-[var(--ds-radius-sm)] border px-3 py-2.5 text-sm ${STYLES[type]}`}
      role={type === "error" ? "alert" : "status"}
    >
      {message}
    </div>
  );
}
