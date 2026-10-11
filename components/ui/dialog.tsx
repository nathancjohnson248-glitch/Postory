"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Accessible modal built on the native <dialog> element: focus is trapped,
 * Escape closes it, and focus returns to the trigger on close.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        "m-auto w-[calc(100%-2rem)] max-w-lg rounded-3xl bg-surface p-0 text-ink shadow-float ring-1 ring-line backdrop:bg-transparent open:animate-[fade-up_0.25s_var(--ease-out-soft)]",
        className,
      )}
    >
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="text-lg font-semibold tracking-[-0.015em]">
              {title}
            </h2>
            {description ? (
              <p id={descId} className="mt-1.5 text-sm leading-relaxed text-muted">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-8 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-wash hover:text-ink"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>
        {children ? <div className="mt-5">{children}</div> : null}
      </div>
      {footer ? <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-paper/60 px-6 py-4">{footer}</div> : null}
    </dialog>
  );
}
