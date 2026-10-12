import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/app/section";
import { CancelSubscriptionButton, ChangePlanCards, ManageBillingButton, RefreshBillingButton, ResumeSubscriptionButton } from "@/components/billing/billing-actions";
import { PlanCards } from "@/components/billing/plan-cards";
import { PlanPicker } from "@/components/billing/plan-picker";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/notice";
import { requireAppAccess } from "@/lib/auth/access";
import { PLANS, TRIAL_DAYS, isPlanId } from "@/lib/billing/plans";
import { billingAvailability, syncSubscription } from "@/lib/billing/service";
import { getEntitlements, getUsageSummary } from "@/lib/entitlements";
import { formatInZone, formatRelativeDay, safeTimeZone } from "@/lib/time";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Billing" };

const STATUS: Record<string, { label: string; tone: "success" | "blue" | "warning" | "danger" | "neutral" }> = {
  trialing: { label: "Trial", tone: "blue" },
  active: { label: "Active", tone: "success" },
  past_due: { label: "Payment due", tone: "warning" },
  canceled: { label: "Cancelled", tone: "neutral" },
  expired: { label: "Expired", tone: "neutral" },
  incomplete: { label: "Incomplete", tone: "warning" },
  pending: { label: "Pending", tone: "neutral" },
};

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ billing?: string; checkout?: string }> }) {
  const { user, profile } = await requireAppAccess();
  const params = await searchParams;
  const tz = safeTimeZone(profile.timezone);
  const subscription = await syncSubscription(user.id);
  const [entitlements, availability] = [await getEntitlements(user.id), billingAvailability()];
  const usage = entitlements.active ? await getUsageSummary(user.id, entitlements) : [];
  const status = subscription ? STATUS[subscription.status] : null;
  const live = subscription && ["trialing", "active", "past_due"].includes(subscription.status);
  const fmt = (d: string | null) => (d ? formatInZone(d, tz, { month: "long", day: "numeric", year: "numeric" }) : null);

  return (
    <>
      <PageHeader title="Billing" description={`Solo, Pro or Max — every plan starts with a ${TRIAL_DAYS}-day trial.`} />

      {params.billing === "confirmed" ? <Notice tone="success" title="HandyPay confirmed your subscription." className="mb-6" /> : null}
      {params.billing === "pending" ? (
        <Notice tone="info" title="HandyPay hasn't confirmed the payment yet." className="mb-6">
          Refresh in a moment — this page reads your subscription straight from HandyPay.
        </Notice>
      ) : null}
      {params.billing === "error" ? <Notice tone="warning" title="We couldn't reach HandyPay to confirm your subscription. Refresh in a minute; you won't be charged twice." className="mb-6" /> : null}
      {params.checkout === "canceled" ? <Notice tone="info" title="Checkout was cancelled. No charge was made." className="mb-6" /> : null}

      {!availability.configured ? (
        <Notice tone="info" title="Billing isn't configured on this deployment." className="mb-6">
          HANDYPAY_API_KEY is missing, so plans can&apos;t be purchased here. Nothing will be charged.
        </Notice>
      ) : null}
      {params.billing === "expired" ? <Notice tone="info" title="That checkout expired before it was completed. No charge was made." className="mb-6" /> : null}

      {entitlements.source === "development_override" ? (
        <Notice tone="warning" title="Development plan override is on." className="mb-6">
          POSTORY_DEV_PLAN grants {entitlements.plan ? PLANS[entitlements.plan].name : "a plan"} locally. It has no effect in production and involves no billing.
        </Notice>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <section className="rounded-3xl bg-surface p-6 shadow-soft ring-1 ring-line sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Current plan</p>
              <p className="mt-3 text-[40px] font-semibold leading-none tracking-[-0.03em]">
                {subscription && isPlanId(subscription.plan) ? PLANS[subscription.plan].name : "No plan"}
              </p>
              {subscription && isPlanId(subscription.plan) ? (
                <p className="mt-2 text-[14px] text-muted">${PLANS[subscription.plan].priceMonthlyUsd}/month</p>
              ) : (
                <p className="mt-2 text-[14px] text-muted">Choose a plan to generate and publish.</p>
              )}
            </div>
            {status ? (
              <Badge tone={status.tone} dot>
                {status.label}
              </Badge>
            ) : null}
          </div>

          {subscription ? (
            <dl className="mt-7 grid grid-cols-1 gap-4 border-t border-line pt-6 sm:grid-cols-2">
              {subscription.status === "trialing" && subscription.trial_ends_at ? (
                <div>
                  <dt className="text-[13px] text-muted">Trial ends</dt>
                  <dd className="mt-0.5 text-[15px] font-medium">{fmt(subscription.trial_ends_at)}</dd>
                </div>
              ) : null}
              {subscription.current_period_end ? (
                <div>
                  <dt className="text-[13px] text-muted">{subscription.cancel_at_period_end || subscription.status === "canceled" ? "Access until" : "Renews"}</dt>
                  <dd className="mt-0.5 text-[15px] font-medium">{fmt(subscription.current_period_end)}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-[13px] text-muted">Last checked with HandyPay</dt>
                <dd className="mt-0.5 text-[15px] font-medium">{subscription.last_synced_at ? formatRelativeDay(subscription.last_synced_at, tz) : "Never"}</dd>
              </div>
            </dl>
          ) : null}

          {subscription?.provider_subscription_id && availability.manage ? (
            <div className="mt-7 flex flex-col gap-4 rounded-2xl bg-wash p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div className="min-w-0">
                <p className="text-[14.5px] font-medium">Card, receipts, plan and cancellation</p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-muted">
                  Opens HandyPay&apos;s secure page for your subscription — the same one linked in your HandyPay emails.
                </p>
              </div>
              <ManageBillingButton />
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap items-center gap-2">
            {live && availability.cancel && !subscription?.cancel_at_period_end ? <CancelSubscriptionButton periodEnd={fmt(subscription?.current_period_end ?? null)} /> : null}
            {live && subscription?.cancel_at_period_end ? <ResumeSubscriptionButton /> : null}
            {subscription?.provider_subscription_id ? <RefreshBillingButton /> : null}
          </div>
        </section>

        <section className="rounded-3xl bg-surface p-6 shadow-soft ring-1 ring-line sm:p-7">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">This period</p>
          {usage.length ? (
            <ul className="mt-5 flex flex-col gap-5">
              {usage.map((u) => {
                const pct = u.limit ? Math.min(100, (u.used / u.limit) * 100) : 0;
                return (
                  <li key={u.metric}>
                    <div className="flex items-baseline justify-between text-[13.5px]">
                      <span className="text-ink-soft">{u.label}</span>
                      <span className="tabular-nums text-muted">
                        <span className="font-semibold text-ink">{u.used.toLocaleString()}</span> / {u.limit.toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-blue-100" role="meter" aria-valuemin={0} aria-valuemax={u.limit} aria-valuenow={u.used} aria-label={u.label}>
                      <div className={cn("h-full rounded-full", pct >= 100 ? "bg-danger" : pct >= 85 ? "bg-warning" : "bg-blue-500")} style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-5 text-[14px] text-muted">Usage appears here once you&apos;re on a plan.</p>
          )}
          <div className="mt-7 flex items-start gap-3 rounded-2xl bg-wash p-4">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
            <p className="text-[13px] leading-relaxed text-muted">
              Payment details are held by HandyPay. Postory never sees or stores your card number, so it isn&apos;t shown here.
            </p>
          </div>
        </section>
      </div>

      <div className="mt-12">
        <h2 className="mb-6 text-[20px] font-semibold tracking-[-0.02em]">{live ? "Change plan" : "Plans"}</h2>
        {live && subscription && isPlanId(subscription.plan) && availability.changePlan ? (
          <ChangePlanCards currentPlan={subscription.plan} />
        ) : !live && availability.checkout ? (
          <PlanPicker returnPath="/app/billing" trialEligible={!subscription?.trial_ends_at} />
        ) : (
          <PlanCards
            dense
            currentPlan={subscription && isPlanId(subscription.plan) && live ? subscription.plan : null}
            renderAction={(plan) => (
              <div className={`flex h-12 w-full items-center justify-center rounded-[14px] text-sm ${plan === "pro" ? "bg-white/10 text-white/70" : "bg-wash text-muted"}`}>
                {live ? "Plan changes coming soon" : "Available soon"}
              </div>
            )}
          />
        )}
      </div>
    </>
  );
}
