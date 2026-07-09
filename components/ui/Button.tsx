import type { LucideIcon } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  loading?: boolean;
  children: ReactNode;
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: "ds-btn-primary",
  secondary: "ds-btn-secondary",
  ghost: "ds-btn-ghost",
  danger: "ds-btn-danger",
  success: "ds-btn-success",
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: "ds-btn-sm",
  md: "",
  lg: "ds-btn-lg",
};

export default function Button({
  variant = "secondary",
  size = "md",
  icon: Icon,
  loading = false,
  disabled,
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={`ds-btn ${VARIANT_CLASS[variant]} ${SIZE_CLASS[size]} ${className}`.trim()}
      {...props}
    >
      {loading ? (
        <span className="ds-spinner" aria-hidden="true" />
      ) : Icon ? (
        <Icon className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
      ) : null}
      {children}
    </button>
  );
}
