"use client";

import { showError } from "@/lib/client/show-error";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { cancelSubscriptionAction, openBillingPortal, refreshSubscription, resumeSubscriptionAction, startPlanCheckout } from "@/app/_actions/billing";
import { PLANS, type PlanId } from "@/lib/billing/plans";
import { PlanCards } from "./plan-cards";

export function RefreshBillingButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      icon={<RefreshCw className={pending ? "size-3.5 animate-spin" : "size-3.5"} />}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const result = await refreshSubscription();
          if (!result.ok) showError(result.error);
          router.refresh();
        })
      }
    >
      Refresh from HandyPay
    </Button>
  );
}

export function ManageBillingButton() {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="accent"
      icon={<ExternalLink className="size-4" />}
      loading={pending}
      onClick={() =>
        start(async () => {
          const result = await openBillingPortal();
          if (result.ok) window.location.assign(result.data.url);
          else showError(result.error);
        })
      }
    >
      Manage plan
    </Button>
  );
}

export function CancelSubscriptionButton({ periodEnd }: { periodEnd: string | null }) {
  const router = useRouter();
  return (
    <ConfirmButton
      variant="ghost"
      title="Cancel your subscription?"
      description={`${periodEnd ? `You keep access until ${periodEnd}. ` : ""}Your stories, posts and connections stay in Postory — nothing is deleted.`}
      confirmLabel="Cancel subscription"
      onConfirm={async () => {
        const result = await cancelSubscriptionAction();
        if (result.ok) toast.success("Subscription cancelled.");
        else showError(result.error);
        router.refresh();
      }}
    >
      Cancel subscription
    </ConfirmButton>
  );
}

export function ResumeSubscriptionButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="accent"
      loading={pending}
      onClick={() =>
        start(async () => {
          const result = await resumeSubscriptionAction();
          if (result.ok) toast.success("Your subscription will continue.");
          else showError(result.error);
          router.refresh();
        })
      }
    >
      Keep my subscription
    </Button>
  );
}

/**
 * HandyPay has no in-place plan update, so a change is a new checkout for the
 * new plan; once HandyPay confirms it, Postory ends the old subscription.
 */
export function ChangePlanCards({ currentPlan }: { currentPlan: PlanId }) {
  const order: PlanId[] = ["solo", "pro", "max"];
  return (
    <PlanCards
      currentPlan={currentPlan}
      dense
      renderAction={(plan) =>
        plan === currentPlan ? (
          <div className="flex h-12 items-center justify-center rounded-[14px] bg-wash text-sm font-medium text-muted">Your plan</div>
        ) : (
          <ConfirmButton
            className="w-full"
            size="lg"
            variant={plan === "pro" ? "accent" : "secondary"}
            confirmVariant="primary"
            title={`Switch to ${PLANS[plan].name}?`}
            description={`You'll check out on HandyPay at $${PLANS[plan].priceMonthlyUsd}/month, starting today. When HandyPay confirms it, your current plan ends immediately — unused time on it isn't prorated or refunded.`}
            confirmLabel="Continue to HandyPay"
            onConfirm={async () => {
              const result = await startPlanCheckout(plan, "/app/billing");
              if (result.ok) window.location.assign(result.data.url);
              else showError(result.error);
            }}
          >
            {order.indexOf(plan) > order.indexOf(currentPlan) ? "Upgrade" : "Downgrade"}
          </ConfirmButton>
        )
      }
    />
  );
}
