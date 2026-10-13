"use client";

import { showError } from "@/lib/client/show-error";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PlanCards } from "./plan-cards";
import { startPlanCheckout } from "@/app/_actions/billing";
import type { PlanId } from "@/lib/billing/plans";

/** Plan cards wired to HandyPay checkout. Only rendered when checkout is available. */
export function PlanPicker({ returnPath, trialEligible }: { returnPath: "/onboarding" | "/start" | "/app/billing"; trialEligible: boolean }) {
  const [pending, setPending] = useState<PlanId | null>(null);

  async function choose(plan: PlanId) {
    setPending(plan);
    const result = await startPlanCheckout(plan, returnPath);
    if (!result.ok) {
      setPending(null);
      showError(result.error);
      return;
    }
    window.location.assign(result.data.url);
  }

  return (
    <PlanCards
      renderAction={(plan) => (
        <Button
          className="w-full"
          variant={plan === "pro" ? "accent" : "secondary"}
          size="lg"
          loading={pending === plan}
          disabled={pending !== null && pending !== plan}
          onClick={() => choose(plan)}
        >
          {trialEligible ? "Start 3-day trial" : "Choose plan"}
        </Button>
      )}
    />
  );
}
