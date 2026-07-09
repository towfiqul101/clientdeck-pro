"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils/helpers";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Tailwind max-width class. */
  size?: "md" | "lg" | "xl";
}

const sizes = {
  md: "max-w-md",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "lg",
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-6">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        className={cn(
          "app-content relative z-10 my-8 w-full rounded-2xl border shadow-[0_24px_64px_rgba(0,0,0,0.6)]",
          sizes[size]
        )}
        style={{
          background: "var(--overlay-surface)",
          borderColor: "var(--overlay-border)",
        }}
        role="dialog"
        aria-modal="true"
      >
        <div
          className="flex items-start justify-between gap-4 border-b px-6 py-4"
          style={{ borderColor: "var(--overlay-divide)" }}
        >
          <div>
            <h2
              className="text-base font-semibold"
              style={{ color: "var(--overlay-text)" }}
            >
              {title}
            </h2>
            {description && (
              <p
                className="mt-0.5 text-sm"
                style={{ color: "var(--overlay-text-muted)" }}
              >
                {description}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 hover:bg-black/5"
            style={{ color: "var(--overlay-text-muted)" }}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-6 py-5" style={{ color: "var(--overlay-text)" }}>
          {children}
        </div>
        {footer && (
          <div
            className="flex justify-end gap-2 border-t px-6 py-4"
            style={{ borderColor: "var(--overlay-divide)" }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
