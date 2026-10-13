"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Notice } from "@/components/ui/notice";
import { PLATFORM_META, isPlatform } from "@/lib/social/platforms";

/** Shows the outcome of a network connection after returning from the provider, then cleans the URL. */
export function ConnectionReturnToast() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const result = params.get("connect");
  const platform = params.get("platform");

  useEffect(() => {
    if (!result) return;
    const name = platform && isPlatform(platform) ? PLATFORM_META[platform].name : "Account";
    const over = Number(params.get("over_limit") ?? 0);
    if (result === "success") {
      toast.success(`${name} connected.`);
      if (over > 0) toast.info(`${over === 1 ? "One more account was" : `${over} more accounts were`} left out to stay within your plan.`);
    }
    // The reason is stored server-side and shown on the network's row; nothing from the URL is displayed.
    else toast.error(`${name} wasn't connected. The reason is shown next to it.`);
    const next = new URLSearchParams(params);
    ["connect", "platform", "over_limit"].forEach((k) => next.delete(k));
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  }, [result, platform, params, pathname, router]);

  return null;
}

export function CheckoutReturnNotice({ status }: { status: string }) {
  if (status === "pending") {
    return (
      <Notice tone="info" title="We're waiting for HandyPay to confirm your payment." className="mx-auto mb-6 max-w-2xl">
        This page reads your subscription straight from HandyPay. Refresh in a moment.
      </Notice>
    );
  }
  if (status === "expired") {
    return (
      <Notice tone="info" title="That checkout expired before it was completed." className="mx-auto mb-6 max-w-2xl">
        Nothing was charged. Choose a plan to start a fresh checkout.
      </Notice>
    );
  }
  if (status === "error") {
    return (
      <Notice tone="warning" title="We couldn't confirm your subscription with HandyPay." className="mx-auto mb-6 max-w-2xl">
        If you completed checkout, refresh this page in a minute. You won&apos;t be charged twice.
      </Notice>
    );
  }
  return null;
}
