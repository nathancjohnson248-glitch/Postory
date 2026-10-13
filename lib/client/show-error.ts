"use client";

import { toast } from "sonner";
import type { ActionError, Upgrade } from "@/lib/errors";

export const UPGRADE_EVENT = "postory:upgrade";

/**
 * Show a failed action to the user. Plan limits open the upgrade modal (the
 * action does not continue); everything else is a toast with the server's
 * plain-language message and, when there is one, its next step.
 */
export function showError(error: ActionError) {
  if (error.upgrade) {
    window.dispatchEvent(new CustomEvent<Upgrade>(UPGRADE_EVENT, { detail: error.upgrade }));
    return;
  }
  toast.error(error.message, error.action ? { action: { label: error.action.label, onClick: () => window.location.assign(error.action!.href) } } : undefined);
}
