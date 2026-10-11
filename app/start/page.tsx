import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Check, Lock } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { PlanPicker } from "@/components/billing/plan-picker";
import { DeleteAccount } from "@/components/app/settings/forms";
import { CheckoutReturnNotice } from "@/components/onboarding/return-notices";
import { Notice } from "@/components/ui/notice";
import { getAdminRole } from "@/lib/auth/admin";
import { requireOnboardedUser } from "@/lib/auth/session";
import { billingAvailability, getSubscriptionRow } from "@/lib/billing/service";
import { TRIAL_DAYS } from "@/lib/billing/plans";
import { getEntitlements } from "@/lib/entitlements";

export const metadata: Metadata = { title: "Start your trial", robots: { index: false } };

const INCLUDED = ["Posts written for every network you use", "Nothing publishes without your approval", "Calendar, scheduling and business memory", "Cancel any time — your work is kept"];

/**
 * Where everyone without an active trial or plan lands. Postory's app opens
 * once HandyPay confirms a trial or subscription (read from HandyPay, never
 * from the browser).
 */
export default async function StartPage({ searchParams }: { searchParams: Promise<{ checkout?: string; billing?: string }> }) {
  const { user } = await requireOnboardedUser();
  const [entitlements, adminRole, subscription, params] = await Promise.all([
    getEntitlements(user.id),
    getAdminRole(user),
    getSubscriptionRow(user.id),
    searchParams,
  ]);
  if (entitlements.active || adminRole) redirect("/app");

  const availability = billingAvailability();
  // One trial per customer — matches what checkout will actually offer.
  const trialEligible = !subscription;

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <div className="hairline-grid absolute inset-0 -z-10 opacity-60 [mask-image:radial-gradient(ellipse_at_top,black,transparent_65%)]" aria-hidden />
      <div className="glow-breathe absolute left-1/2 top-24 -z-10 h-72 w-[min(900px,90vw)] -translate-x-1/2 rounded-full bg-blue-300/20 blur-3xl" aria-hidden />

      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6 sm:px-8">
        <Link href="/" aria-label="Postory home" className="rounded-lg">
          <Logo />
        </Link>
        <form action="/auth/signout" method="post">
          <button className="rounded-lg px-2 py-1 text-sm text-muted transition-colors hover:text-ink">Sign out</button>
        </form>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-20 sm:px-8">
        <div className="mx-auto max-w-3xl pt-6 text-center sm:pt-10">
          <p className="fade-rise mx-auto inline-flex items-center gap-2 rounded-full bg-surface px-3.5 py-1.5 text-[13px] font-medium text-ink-soft shadow-soft ring-1 ring-line">
            <Lock className="size-3.5 text-blue-600" aria-hidden />
            {trialEligible ? `${TRIAL_DAYS} days free, then billed monthly` : "Choose a plan to continue"}
          </p>
          <h1 className="fade-rise mt-6 font-display text-[46px] leading-[0.98] tracking-[-0.025em] text-balance sm:text-[72px]" style={{ animationDelay: "0.08s" }}>
            {trialEligible ? (
              <>
                Start your {TRIAL_DAYS}-day trial <em className="text-blue-600">to open Postory.</em>
              </>
            ) : (
              <>
                Pick up <em className="text-blue-600">where you left off.</em>
              </>
            )}
          </h1>
          <p className="fade-rise mx-auto mt-5 max-w-xl text-[16px] leading-relaxed text-muted text-pretty sm:text-[17px]" style={{ animationDelay: "0.16s" }}>
            {trialEligible
              ? "Choose a plan. You won't be charged until the trial ends, and you can cancel any time before then from Billing."
              : "Your trial has ended. Choose a plan to keep creating and publishing — every story and post you made is still here."}
          </p>
          <ul className="fade-rise mx-auto mt-7 grid max-w-2xl grid-cols-1 gap-x-6 gap-y-2 text-left text-[14px] text-ink-soft sm:grid-cols-2" style={{ animationDelay: "0.24s" }}>
            {INCLUDED.map((item) => (
              <li key={item} className="flex items-center gap-2.5">
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-blue-50 text-blue-600">
                  <Check className="size-3" aria-hidden />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="fade-rise mt-12" style={{ animationDelay: "0.32s" }}>
          {params.billing ? <CheckoutReturnNotice status={params.billing} /> : null}
          {params.checkout === "canceled" ? <Notice tone="info" title="Checkout was cancelled. No charge was made." className="mx-auto mb-6 max-w-2xl" /> : null}
          {availability.checkout ? (
            <PlanPicker returnPath="/start" trialEligible={trialEligible} />
          ) : (
            <Notice tone="info" title="Billing isn't switched on for this deployment" className="mx-auto max-w-2xl">
              Plans can&apos;t be purchased right now. <Link href="/app" className="font-medium underline underline-offset-2">Continue to Postory</Link>.
            </Notice>
          )}
          <p className="mx-auto mt-6 max-w-2xl text-center text-[13px] text-faint">Payments are handled by HandyPay. Postory never sees or stores your card details.</p>
        </div>

        <div className="mx-auto mt-16 flex max-w-2xl flex-col items-center gap-3 border-t border-line pt-8 text-center text-[13px] text-muted">
          <p>
            Signed in as <span className="font-medium text-ink-soft">{user.email}</span>
          </p>
          <details className="group">
            <summary className="cursor-pointer list-none text-faint transition-colors hover:text-ink-soft">Not for you? Delete your account</summary>
            <div className="mt-4 flex justify-center">
              <DeleteAccount />
            </div>
          </details>
        </div>
      </main>
    </div>
  );
}
