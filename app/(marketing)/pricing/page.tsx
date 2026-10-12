import type { Metadata } from "next";
import Link from "next/link";
import { PlanCards } from "@/components/billing/plan-cards";
import { Faq } from "@/components/marketing/faq";
import { PageHero } from "@/components/marketing/page-hero";
import { buttonClasses } from "@/components/ui/button";
import { PLANS, PLAN_IDS, TRIAL_DAYS } from "@/lib/billing/plans";

export const metadata: Metadata = {
  title: "Pricing",
  description: `Solo $15, Pro $29, Max $59 a month. Every Postory plan starts with a ${TRIAL_DAYS}-day trial.`,
  alternates: { canonical: "/pricing" },
};

const ROWS: { label: string; get: (id: (typeof PLAN_IDS)[number]) => string }[] = [
  { label: "Social accounts", get: (id) => (PLANS[id].limits.socialAccounts === null ? "Unlimited" : String(PLANS[id].limits.socialAccounts)) },
  { label: "AI post generations / month", get: (id) => String(PLANS[id].limits.aiGenerations) },
  { label: "AI conversations / month", get: (id) => String(PLANS[id].limits.aiConversations) },
  { label: "AI images / month", get: (id) => String(PLANS[id].limits.aiImages) },
  { label: "X credits / month", get: (id) => PLANS[id].limits.xCredits.toLocaleString("en-US") },
  { label: "Scheduled posts", get: () => "Unlimited (fair use)" },
  { label: "Approval workflow, calendar, business memory", get: () => "✓" },
  { label: "Unified inbox", get: (id) => (PLANS[id].features.unifiedInbox ? "✓" : "—") },
  { label: "Advanced analytics", get: (id) => (PLANS[id].features.advancedAnalytics ? "✓" : "—") },
  { label: "Advanced planning", get: (id) => (PLANS[id].features.advancedPlanning ? "✓" : "—") },
];

export default function PricingPage() {
  return (
    <>
      <PageHero eyebrow="Pricing" title={<>Pick a plan. <em className="text-blue-600">Start with a story.</em></>} body={`Every plan starts with a ${TRIAL_DAYS}-day trial, billed securely through HandyPay. No permanent free plan — and no surprises.`} />
      <section className="mx-auto max-w-7xl px-5 pb-20 sm:px-8">
        <PlanCards
          renderAction={(plan) => (
            <Link href={`/signup?plan=${plan}`} className={buttonClasses({ size: "lg", variant: plan === "pro" ? "accent" : "secondary", className: "w-full" })}>
              Start 3-day trial
            </Link>
          )}
        />
      </section>
      <section className="mx-auto max-w-5xl px-5 pb-24 sm:px-8">
        <h2 className="mb-6 text-[22px] font-semibold tracking-[-0.02em]">Compare plans</h2>
        <div className="overflow-x-auto rounded-3xl bg-surface shadow-soft ring-1 ring-line">
          <table className="w-full min-w-[560px] text-left text-[14px]">
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="px-5 py-4 font-medium text-muted">
                  <span className="sr-only">Feature</span>
                </th>
                {PLAN_IDS.map((id) => (
                  <th key={id} scope="col" className={`px-5 py-4 font-semibold ${id === "pro" ? "text-blue-600" : ""}`}>
                    {PLANS[id].name} · ${PLANS[id].priceMonthlyUsd}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.label} className="border-b border-line last:border-0">
                  <th scope="row" className="px-5 py-3.5 font-normal text-ink-soft">
                    {row.label}
                  </th>
                  {PLAN_IDS.map((id) => (
                    <td key={id} className="px-5 py-3.5 tabular-nums">
                      {row.get(id)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="mx-auto max-w-3xl px-5 pb-28 sm:px-8">
        <h2 className="mb-6 text-[22px] font-semibold tracking-[-0.02em]">Questions</h2>
        <Faq />
      </section>
    </>
  );
}
