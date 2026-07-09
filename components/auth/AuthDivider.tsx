interface AuthDividerProps {
  label?: string;
}

export default function AuthDivider({ label = "or continue with email" }: AuthDividerProps) {
  return (
    <div className="relative my-6">
      <div className="absolute inset-0 flex items-center" aria-hidden="true">
        <div className="w-full border-t border-[var(--ds-border)]" />
      </div>
      <p className="relative mx-auto w-fit bg-[var(--ds-bg-elevated)] px-3 text-xs text-[var(--ds-text-tertiary)]">
        {label}
      </p>
    </div>
  );
}
