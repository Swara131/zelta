"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export type ModalVariant = "center" | "slideout";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  variant?: ModalVariant;
  size?: "md" | "lg" | "xl";
  /** Prevent closing when clicking backdrop */
  dismissible?: boolean;
  panelClassName?: string;
  bodyClassName?: string;
  footerClassName?: string;
}

const SIZE_CLASS: Record<NonNullable<ModalProps["size"]>, string> = {
  md: "modal-panel-md",
  lg: "modal-panel-lg",
  xl: "modal-panel-xl",
};

export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  variant = "slideout",
  size = "lg",
  dismissible = true,
  panelClassName = "",
  bodyClassName = "",
  footerClassName = "",
}: ModalProps) {
  const titleId = useId();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && dismissible) {
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose, dismissible]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className={`modal-overlay ${variant === "slideout" ? "modal-overlay-slideout" : "modal-overlay-center"}`.trim()}
      role="presentation"
    >
      <div
        className="modal-backdrop"
        onClick={dismissible ? onClose : undefined}
        aria-hidden="true"
      />
      <div
        className={`modal-panel ${variant === "slideout" ? "modal-panel-slideout" : "modal-panel-center"} ${SIZE_CLASS[size]} ${panelClassName}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
      >
        {title ? (
          <header className="modal-header">
            <h2 id={titleId} className="modal-title">
              {title}
            </h2>
            {dismissible ? (
              <button
                type="button"
                className="modal-close"
                onClick={onClose}
                aria-label="Close"
              >
                <X className="h-5 w-5" strokeWidth={2} />
              </button>
            ) : null}
          </header>
        ) : null}
        <div className={`modal-body ${bodyClassName}`.trim()}>{children}</div>
        {footer ? (
          <div className={`modal-footer ${footerClassName}`.trim()}>{footer}</div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
