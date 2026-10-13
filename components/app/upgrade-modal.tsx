"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { Button, ButtonLink } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { UPGRADE_EVENT } from "@/lib/client/show-error";
import type { Upgrade } from "@/lib/errors";

/**
 * One modal for every plan limit (AI posts, images, conversations, accounts)
 * and every plan-only feature. "Not now" just closes it; the blocked action
 * stays blocked until the period resets or the plan changes.
 */
export function UpgradeModal() {
  const [upgrade, setUpgrade] = useState<Upgrade | null>(null);

  useEffect(() => {
    const onUpgrade = (e: Event) => setUpgrade((e as CustomEvent<Upgrade>).detail);
    window.addEventListener(UPGRADE_EVENT, onUpgrade);
    return () => window.removeEventListener(UPGRADE_EVENT, onUpgrade);
  }, []);

  if (!upgrade) return null;
  return (
    <Dialog
      open
      onClose={() => setUpgrade(null)}
      title={
        <span className="flex items-center gap-3">
          <LogoMark className="size-8" blink={false} />
          {upgrade.title}
        </span>
      }
      description={upgrade.body}
    >
      <div className="flex flex-col gap-3">
        {upgrade.currentPlan ? (
          <p className="text-[13px] text-muted">
            You&apos;re on <span className="font-medium text-ink">{upgrade.currentPlan}</span>.
          </p>
        ) : null}
        {upgrade.next ? (
          <div className="rounded-2xl bg-blue-50 p-4 ring-1 ring-blue-100">
            <p className="text-[14px] font-semibold text-blue-900">{upgrade.next.name}</p>
            <p className="mt-0.5 text-[13.5px] text-blue-800">{upgrade.next.offer}</p>
          </div>
        ) : (
          <p className="text-[13.5px] text-muted">You&apos;re already on the biggest plan. Your allowance refreshes when your next billing period starts.</p>
        )}
        <div className="mt-2 flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={() => setUpgrade(null)}>
            Not now
          </Button>
          {upgrade.next ? (
            <ButtonLink href={`/app/billing?plan=${upgrade.next.id}#plans`} variant="accent" icon={<ArrowUpRight className="size-4" aria-hidden />} onClick={() => setUpgrade(null)}>
              {upgrade.currentPlan ? `Upgrade to ${upgrade.next.name}` : `Start ${upgrade.next.name}`}
            </ButtonLink>
          ) : (
            <ButtonLink href="/app/billing" variant="secondary" onClick={() => setUpgrade(null)}>
              Manage plan
            </ButtonLink>
          )}
        </div>
      </div>
    </Dialog>
  );
}
