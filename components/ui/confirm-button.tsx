"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

/**
 * A button that asks for explicit confirmation before running a consequential
 * action (publishing, disconnecting, cancelling, deleting).
 */
export function ConfirmButton({
  children,
  title,
  description,
  confirmLabel,
  onConfirm,
  variant = "secondary",
  confirmVariant = "danger",
  size = "md",
  icon,
  disabled,
  body,
  className,
}: {
  children: ReactNode;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  onConfirm: () => Promise<void> | void;
  variant?: "primary" | "accent" | "secondary" | "ghost" | "danger";
  confirmVariant?: "primary" | "accent" | "danger";
  size?: "sm" | "md" | "lg";
  icon?: ReactNode;
  disabled?: boolean;
  body?: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button variant={variant} size={size} icon={icon} disabled={disabled} onClick={() => setOpen(true)} className={className}>
        {children}
      </Button>
      <Dialog
        open={open}
        onClose={() => !pending && setOpen(false)}
        title={title}
        description={description}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button
              variant={confirmVariant}
              loading={pending}
              onClick={() =>
                startTransition(async () => {
                  await onConfirm();
                  setOpen(false);
                })
              }
            >
              {confirmLabel}
            </Button>
          </>
        }
      >
        {body}
      </Dialog>
    </>
  );
}
