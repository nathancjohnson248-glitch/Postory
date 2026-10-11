import { describe, expect, it } from "vitest";
import { estimatedCharges, paidSince, periodsCharged, summarizeRevenue, type RevenueSubscription } from "@/lib/admin/metrics";

const d = (s: string) => new Date(s);
const NOW = d("2026-10-11T12:00:00Z");

function sub(overrides: Partial<RevenueSubscription>): RevenueSubscription {
  return {
    status: "active",
    plan: "pro",
    amountCents: 2900,
    monthlyCents: 2900,
    interval: "month",
    intervalCount: 1,
    createdAt: d("2026-07-01T10:00:00Z"),
    trialEndsAt: null,
    canceledAt: null,
    endedAt: null,
    currentPeriodEnd: d("2026-11-01T10:00:00Z"),
    cancelAtPeriodEnd: false,
    ...overrides,
  };
}

describe("paidSince", () => {
  it("starts billing when the trial ends", () => {
    expect(paidSince(sub({ createdAt: d("2026-09-01T00:00:00Z"), trialEndsAt: d("2026-09-04T00:00:00Z") }), NOW)).toEqual(d("2026-09-04T00:00:00Z"));
  });
  it("is null while the trial is still running", () => {
    expect(paidSince(sub({ status: "trialing", trialEndsAt: d("2026-10-13T00:00:00Z") }), NOW)).toBeNull();
  });
  it("is null when cancelled during the trial", () => {
    expect(paidSince(sub({ status: "canceled", trialEndsAt: d("2026-10-04T00:00:00Z"), endedAt: d("2026-10-03T00:00:00Z") }), NOW)).toBeNull();
  });
  it("never counts incomplete subscriptions", () => {
    expect(paidSince(sub({ status: "incomplete" }), NOW)).toBeNull();
  });
});

describe("periodsCharged", () => {
  it("counts the first charge plus each whole month since", () => {
    // Jul 1, Aug 1, Sep 1, Oct 1
    expect(periodsCharged(sub({}), NOW)).toBe(4);
  });
  it("does not count the renewal of a past-due period", () => {
    expect(periodsCharged(sub({ status: "past_due" }), NOW)).toBe(3);
  });
  it("stops at the end date and doesn't count a renewal that never happened", () => {
    // Paid Jul 1, Aug 1, Sep 1; ended exactly at the Oct 1 renewal.
    expect(periodsCharged(sub({ status: "canceled", endedAt: d("2026-10-01T10:00:00Z") }), NOW)).toBe(3);
  });
  it("handles yearly plans", () => {
    expect(periodsCharged(sub({ interval: "year", createdAt: d("2025-03-01T00:00:00Z") }), NOW)).toBe(2);
  });
  it("is zero for a subscription still in trial", () => {
    expect(periodsCharged(sub({ status: "trialing", trialEndsAt: d("2026-10-14T00:00:00Z") }), NOW)).toBe(0);
  });
});

describe("summarizeRevenue", () => {
  const subs: RevenueSubscription[] = [
    sub({}),
    sub({ plan: "solo", amountCents: 1500, monthlyCents: 1500, status: "past_due" }),
    sub({ plan: "max", amountCents: 5900, monthlyCents: 5900, status: "trialing", createdAt: d("2026-10-10T00:00:00Z"), trialEndsAt: d("2026-10-13T00:00:00Z") }),
    sub({ status: "canceled", createdAt: d("2026-05-01T00:00:00Z"), endedAt: d("2026-09-20T00:00:00Z"), canceledAt: d("2026-09-20T00:00:00Z") }),
    sub({ plan: "pro", interval: "year", amountCents: 29000, monthlyCents: 2417, createdAt: d("2026-08-15T00:00:00Z") }),
  ];
  const summary = summarizeRevenue(subs, NOW);

  it("counts active and past-due subscriptions as MRR, not trials or ended ones", () => {
    expect(summary.mrrCents).toBe(2900 + 1500 + 2417);
    expect(summary.arrCents).toBe((2900 + 1500 + 2417) * 12);
    expect(summary.payingCount).toBe(3);
    expect(summary.pastDueCount).toBe(1);
  });
  it("tracks trials separately", () => {
    expect(summary.trialingCount).toBe(1);
    expect(summary.trialPipelineCents).toBe(5900);
  });
  it("counts churn in the last 30 days", () => {
    expect(summary.churned30Count).toBe(1);
  });
  it("builds a six-month MRR series ending with today's MRR", () => {
    expect(summary.monthly).toHaveLength(6);
    expect(summary.monthly.at(-1)?.mrrCents).toBe(summary.mrrCents);
    expect(summary.monthly.map((m) => m.label)).toEqual(["May", "Jun", "Jul", "Aug", "Sep", "Oct"]);
    // End of August: the July sub, the past-due solo (from July), the cancelled one (ends Sep 20) and the yearly (Aug 15).
    expect(summary.monthly[3].mrrCents).toBe(2900 + 1500 + 2900 + 2417);
  });
  it("splits customers by plan", () => {
    const pro = summary.byPlan.find((p) => p.plan === "pro");
    expect(pro).toEqual({ plan: "pro", paying: 2, trialing: 0 });
    expect(summary.byPlan.find((p) => p.plan === "max")).toEqual({ plan: "max", paying: 0, trialing: 1 });
  });
});

describe("estimatedCharges", () => {
  it("lists one paid row per charged period, newest first, plus an unpaid row when past due", () => {
    const rows = estimatedCharges([{ ...sub({ status: "past_due" }), reference: "sub_1" }], NOW);
    expect(rows.map((r) => [r.date.toISOString().slice(0, 10), r.status])).toEqual([
      ["2026-10-01", "unpaid"],
      ["2026-09-01", "paid"],
      ["2026-08-01", "paid"],
      ["2026-07-01", "paid"],
    ]);
  });
});
