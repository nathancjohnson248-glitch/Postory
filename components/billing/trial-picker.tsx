"use client";

import { showError } from "@/lib/client/show-error";
import { useState } from "react";
import { motion } from "motion/react";
import { ArrowRight, Check, ShieldCheck } from "lucide-react";
import { startPlanCheckout } from "@/app/_actions/billing";
import { Button } from "@/components/ui/button";
import { PLANS, PLAN_IDS, TRIAL_DAYS, type PlanId } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";

const INCLUDED = [
  "All 8 networks",
  "Postory's AI writer and images",
  "Approval before anything posts",
  "Calendar and scheduling",
  "Business memory",
  "An email if a post fails",
];

/**
 * Pick one plan, start one trial. A compact chooser for onboarding and the
 * trial gate: the plans as selectable rows, one sticky call to action.
 */
export function TrialPicker({ returnPath, trialEligible }: { returnPath: "/onboarding" | "/start"; trialEligible: boolean }) {
  const [selected, setSelected] = useState<PlanId>("pro");
  const [pending, setPending] = useState(false);
  const plan = PLANS[selected];

  async function start() {
    setPending(true);
    const result = await startPlanCheckout(selected, returnPath);
    if (!result.ok) {
      setPending(false);
      showError(result.error);
      return;
    }
    window.location.assign(result.data.url);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <fieldset>
        <legend className="mb-4 text-[17px] font-semibold tracking-[-0.015em]">
          {trialEligible ? `Pick a plan. ${TRIAL_DAYS} days free on every plan.` : "Pick a plan."}
        </legend>
        <div className="flex flex-col gap-3">
          {PLAN_IDS.map((id, i) => {
            const p = PLANS[id];
            const on = selected === id;
            const l = p.limits;
            return (
              <motion.label
                key={id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className={cn(
                  "relative block cursor-pointer rounded-3xl bg-surface p-5 ring-1 transition-[box-shadow,background-color] duration-200 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-blue-500 sm:p-6",
                  on ? "bg-blue-50/40 shadow-soft ring-2 ring-blue-500" : "ring-line hover:ring-line-strong",
                )}
              >
                <input type="radio" name="plan" value={id} checked={on} onChange={() => setSelected(id)} className="sr-only" />
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-[17px] font-semibold tracking-[-0.015em]">
                      {p.name}
                      {id === "pro" ? <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[11px] font-semibold text-white">Most popular</span> : null}
                    </p>
                    <p className="mt-0.5 text-[13.5px] text-muted">{p.tagline}</p>
                  </div>
                  <span className={cn("grid size-6 shrink-0 place-items-center rounded-full ring-1 transition-all", on ? "bg-blue-600 text-white ring-blue-600" : "ring-line-strong")}>
                    {on ? <Check className="size-3.5" aria-hidden /> : null}
                  </span>
                </div>
                <p className="mt-4 flex items-baseline gap-1">
                  <span className="font-display text-[44px] leading-none tracking-[-0.03em]">${p.priceMonthlyUsd}</span>
                  <span className="text-sm text-muted">/month</span>
                </p>
                <dl className={cn("mt-4 grid grid-cols-3 gap-2 border-t pt-4 text-[12.5px]", on ? "border-blue-200/70" : "border-line")}>
                  {[
                    ["Accounts", l.socialAccounts === null ? "Unlimited" : String(l.socialAccounts)],
                    ["AI posts / mo", String(l.aiGenerations)],
                    ["AI images / mo", String(l.aiImages)],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-muted">{k}</dt>
                      <dd className="mt-0.5 text-[15px] font-semibold tabular-nums text-ink">{v}</dd>
                    </div>
                  ))}
                </dl>
              </motion.label>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-8">
        <p className="text-center text-[14px] font-semibold">Every plan includes</p>
        <ul className="mx-auto mt-3 grid max-w-md grid-cols-1 gap-2 text-[14px] text-ink-soft sm:grid-cols-2">
          {INCLUDED.map((t) => (
            <li key={t} className="flex items-center gap-2">
              <Check className="size-4 shrink-0 text-blue-600" aria-hidden />
              {t}
            </li>
          ))}
        </ul>
      </div>

      <div className="sticky bottom-0 z-10 -mx-6 mt-8 border-t border-line bg-paper/90 px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur-md sm:mx-0 sm:rounded-3xl sm:border sm:pb-4">
        <Button size="lg" variant="accent" className="w-full" loading={pending} onClick={start}>
          {trialEligible ? `Start ${TRIAL_DAYS}-day trial of ${plan.name}` : `Continue with ${plan.name}`}
          {!pending ? <ArrowRight className="size-4" aria-hidden /> : null}
        </Button>
        <p className="mt-2.5 flex items-center justify-center gap-1.5 text-center text-[12.5px] text-muted">
          <ShieldCheck className="size-3.5 shrink-0 text-success" aria-hidden />
          {trialEligible
            ? `Secure checkout by HandyPay. $0 today — $${plan.priceMonthlyUsd}/month after ${TRIAL_DAYS} days. Cancel anytime.`
            : `Secure checkout by HandyPay. $${plan.priceMonthlyUsd}/month. Cancel anytime.`}
        </p>
      </div>
    </div>
  );
}
