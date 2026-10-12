import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { PLANS, PLAN_IDS, planHighlights, type PlanId } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";

/** Presentational plan cards shared by pricing, onboarding and billing. */
export function PlanCards({
  renderAction,
  currentPlan,
  className,
  dense = false,
}: {
  renderAction: (plan: PlanId) => ReactNode;
  currentPlan?: PlanId | null;
  className?: string;
  dense?: boolean;
}) {
  return (
    <div className={cn("grid grid-cols-1 gap-4 lg:grid-cols-3", className)}>
      {PLAN_IDS.map((id) => {
        const plan = PLANS[id];
        const featured = id === "pro";
        const highlights = planHighlights(plan);
        return (
          <div
            key={id}
            className={cn(
              "relative flex flex-col rounded-3xl p-6",
              featured ? "bg-ink text-white shadow-float lg:-my-3 lg:py-9" : "bg-surface text-ink shadow-soft ring-1 ring-line",
            )}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-semibold tracking-[-0.01em]">{plan.name}</h3>
              {featured ? <span className="rounded-full bg-blue-500 px-2.5 py-1 text-[11px] font-semibold">Most popular</span> : null}
              {currentPlan === id ? (
                <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", featured ? "bg-white/15" : "bg-wash")}>Current plan</span>
              ) : null}
            </div>
            <p className="mt-6 flex items-baseline gap-1">
              <span className="font-display text-[56px] leading-none tracking-[-0.03em]">${plan.priceMonthlyUsd}</span>
              <span className={cn("text-sm", featured ? "text-white/60" : "text-muted")}>/month</span>
            </p>
            <p className={cn("mt-2 text-sm", featured ? "text-white/70" : "text-muted")}>{plan.tagline}</p>
            <div className="mt-6">{renderAction(id)}</div>
            <p className={cn("mt-3 text-center text-xs", featured ? "text-white/50" : "text-faint")}>Cancel anytime</p>
            <ul className={cn("mt-6 flex flex-col gap-2.5 border-t pt-6 text-[13.5px]", featured ? "border-white/10" : "border-line")}>
              {(dense ? highlights.slice(0, 5) : highlights).map((h) => (
                <li key={h} className="flex items-start gap-2.5">
                  <Check className={cn("mt-0.5 size-4 shrink-0", featured ? "text-blue-300" : "text-blue-500")} aria-hidden />
                  <span className={featured ? "text-white/85" : "text-ink-soft"}>{h}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
