"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { cancelSubscriptionAction, changeSubscriptionPlan, openBillingPortal, refreshSubscription } from "@/app/_actions/billing";
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
          if (!result.ok) toast.error(result.error.message);
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
      variant="secondary"
      icon={<ExternalLink className="size-4" />}
      loading={pending}
      onClick={() =>
        start(async () => {
          const result = await openBillingPortal();
          if (result.ok) window.location.assign(result.data.url);
          else toast.error(result.error.message);
        })
      }
    >
      Manage subscription
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
        else toast.error(result.error.message);
        router.refresh();
      }}
    >
      Cancel subscription
    </ConfirmButton>
  );
}

export function ChangePlanCards({ currentPlan }: { currentPlan: PlanId }) {
  const router = useRouter();
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
            description={`${order.indexOf(plan) > order.indexOf(currentPlan) ? "Upgrade" : "Downgrade"} to ${PLANS[plan].name} at $${PLANS[plan].priceMonthlyUsd}/month. HandyPay handles proration and billing dates.`}
            confirmLabel={`Switch to ${PLANS[plan].name}`}
            onConfirm={async () => {
              const result = await changeSubscriptionPlan(plan);
              if (result.ok) toast.success(`You're now on ${PLANS[plan].name}.`);
              else toast.error(result.error.message);
              router.refresh();
            }}
          >
            {order.indexOf(plan) > order.indexOf(currentPlan) ? "Upgrade" : "Downgrade"}
          </ConfirmButton>
        )
      }
    />
  );
}
