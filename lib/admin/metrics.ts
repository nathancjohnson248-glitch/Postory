/**
 * Revenue figures for the admin area, computed from HandyPay subscription
 * records. Pure and deterministic (pass `now`) so it can be tested.
 *
 * HandyPay has no list of individual charges, so "collected" is an estimate:
 * one charge per billing period from the end of the trial (or the start, if
 * there was no trial) up to now, minus the latest period when it is unpaid.
 */

export type RevenueSubscription = {
  status: "trialing" | "active" | "past_due" | "canceled" | "expired" | "incomplete";
  plan: string | null;
  amountCents: number | null;
  monthlyCents: number | null;
  interval: string;
  intervalCount: number;
  createdAt: Date | null;
  trialEndsAt: Date | null;
  canceledAt: Date | null;
  endedAt: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
};

export type RevenueSummary = {
  mrrCents: number;
  arrCents: number;
  payingCount: number;
  trialingCount: number;
  trialPipelineCents: number;
  pastDueCount: number;
  cancelingCount: number;
  churned30Count: number;
  estimatedCollectedCents: number;
  byPlan: { plan: string; paying: number; trialing: number }[];
  monthly: { key: string; label: string; mrrCents: number; newPaying: number }[];
};

const DAY = 24 * 60 * 60 * 1000;

/** When the subscription started being charged, or null if it never was (yet). */
export function paidSince(sub: RevenueSubscription, now: Date): Date | null {
  if (sub.status === "incomplete") return null;
  if (sub.trialEndsAt) {
    if (sub.trialEndsAt > now) return null;
    // A subscription cancelled during its trial was never charged.
    const ended = sub.endedAt ?? (sub.status === "canceled" ? sub.canceledAt : null);
    if (ended && ended <= sub.trialEndsAt) return null;
    return sub.trialEndsAt;
  }
  return sub.createdAt;
}

function endedAt(sub: RevenueSubscription): Date | null {
  if (sub.endedAt) return sub.endedAt;
  if (sub.status === "canceled" || sub.status === "expired") return sub.canceledAt ?? sub.currentPeriodEnd;
  return null;
}

/** Was this subscription paying at `at`, judged by its lifecycle dates? */
export function payingAt(sub: RevenueSubscription, at: Date, now: Date): boolean {
  const start = paidSince(sub, now);
  if (!start || start > at) return false;
  const end = endedAt(sub);
  return !end || end > at;
}

function wholeMonthsBetween(a: Date, b: Date) {
  let months = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
  if (b.getUTCDate() < a.getUTCDate()) months -= 1;
  return Math.max(0, months);
}

/** Billing periods charged so far (estimate). */
export function periodsCharged(sub: RevenueSubscription, now: Date): number {
  const start = paidSince(sub, now);
  if (!start || start > now) return 0;
  const end = endedAt(sub);
  const stop = end && end < now ? end : now;
  const count = Math.max(1, sub.intervalCount);
  let elapsed: number;
  if (sub.interval === "year") elapsed = Math.floor(wholeMonthsBetween(start, stop) / (12 * count));
  else if (sub.interval === "month") elapsed = Math.floor(wholeMonthsBetween(start, stop) / count);
  else if (sub.interval === "week") elapsed = Math.floor((stop.getTime() - start.getTime()) / (7 * DAY * count));
  else elapsed = Math.floor((stop.getTime() - start.getTime()) / (DAY * count));
  // The charge at the start counts; a past-due or lapsed period was not paid.
  // An ending exactly on a renewal boundary means that renewal never happened.
  let periods = elapsed + 1;
  if (end && end <= now && elapsed > 0 && isBoundary(sub, start, end)) periods -= 1;
  if (sub.status === "past_due" || sub.status === "expired") periods -= 1;
  return Math.max(0, periods);
}

function isBoundary(sub: RevenueSubscription, start: Date, end: Date) {
  if (sub.interval === "month" || sub.interval === "year") {
    return end.getUTCDate() === start.getUTCDate() && Math.abs(end.getUTCHours() - start.getUTCHours()) <= 1;
  }
  const span = sub.interval === "week" ? 7 * DAY : DAY;
  return (end.getTime() - start.getTime()) % (span * Math.max(1, sub.intervalCount)) < 60 * 60 * 1000;
}

const MONTH_LABEL = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });

export function summarizeRevenue(subs: RevenueSubscription[], now = new Date(), months = 6): RevenueSummary {
  const live = subs.filter((s) => (s.status === "active" || s.status === "past_due") && paidSince(s, now));
  const trialing = subs.filter((s) => s.status === "trialing");
  const mrrCents = live.reduce((sum, s) => sum + (s.monthlyCents ?? 0), 0);

  const churned30Count = subs.filter((s) => {
    if (s.status !== "canceled" && s.status !== "expired") return false;
    const end = endedAt(s);
    return Boolean(end && end <= now && now.getTime() - end.getTime() <= 30 * DAY);
  }).length;

  const estimatedCollectedCents = subs.reduce((sum, s) => sum + periodsCharged(s, now) * (s.amountCents ?? 0), 0);

  const plans = new Map<string, { paying: number; trialing: number }>();
  for (const s of [...live, ...trialing]) {
    const key = s.plan ?? "unknown";
    const entry = plans.get(key) ?? { paying: 0, trialing: 0 };
    if (s.status === "trialing") entry.trialing += 1;
    else entry.paying += 1;
    plans.set(key, entry);
  }

  const monthly: RevenueSummary["monthly"] = [];
  for (let i = months - 1; i >= 0; i--) {
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const nextMonth = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1));
    const current = i === 0;
    const point = current ? now : new Date(nextMonth.getTime() - 1);
    const mrr = current ? mrrCents : subs.filter((s) => payingAt(s, point, now)).reduce((sum, s) => sum + (s.monthlyCents ?? 0), 0);
    const newPaying = subs.filter((s) => {
      const start = paidSince(s, now);
      return Boolean(start && start >= monthStart && start < nextMonth && start <= now);
    }).length;
    monthly.push({ key: monthStart.toISOString().slice(0, 7), label: MONTH_LABEL.format(monthStart), mrrCents: mrr, newPaying });
  }

  return {
    mrrCents,
    arrCents: mrrCents * 12,
    payingCount: live.length,
    trialingCount: trialing.length,
    trialPipelineCents: trialing.reduce((sum, s) => sum + (s.monthlyCents ?? 0), 0),
    pastDueCount: subs.filter((s) => s.status === "past_due").length,
    cancelingCount: subs.filter((s) => s.cancelAtPeriodEnd && (s.status === "active" || s.status === "trialing" || s.status === "past_due")).length,
    churned30Count,
    estimatedCollectedCents,
    byPlan: [...plans.entries()].map(([plan, v]) => ({ plan, ...v })).sort((a, b) => b.paying + b.trialing - (a.paying + a.trialing)),
    monthly,
  };
}

export function formatUsd(cents: number, options: { compact?: boolean } = {}) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: options.compact || cents % 100 === 0 ? 0 : 2,
    minimumFractionDigits: options.compact || cents % 100 === 0 ? 0 : 2,
    notation: options.compact && Math.abs(cents) >= 1_000_000 ? "compact" : "standard",
  }).format(cents / 100);
}

export type EstimatedCharge = { key: string; reference: string; date: Date; amountCents: number; status: "paid" | "unpaid" };

function addIntervals(start: Date, interval: string, count: number, n: number) {
  const d = new Date(start);
  if (interval === "year") d.setUTCFullYear(d.getUTCFullYear() + n * count);
  else if (interval === "month") d.setUTCMonth(d.getUTCMonth() + n * count);
  else if (interval === "week") d.setTime(d.getTime() + n * count * 7 * DAY);
  else d.setTime(d.getTime() + n * count * DAY);
  return d;
}

/**
 * One row per billing period HandyPay's subscription records imply was
 * charged, newest first; a past-due or lapsed subscription adds its unpaid
 * period. An estimate — receipts live in HandyPay.
 */
export function estimatedCharges(subs: (RevenueSubscription & { reference: string })[], now = new Date(), limit = 500): EstimatedCharge[] {
  const rows: EstimatedCharge[] = [];
  for (const sub of subs) {
    const start = paidSince(sub, now);
    if (!start || sub.amountCents === null) continue;
    const paid = periodsCharged(sub, now);
    for (let n = 0; n < paid; n++) {
      rows.push({ key: `${sub.reference}:${n}`, reference: sub.reference, date: addIntervals(start, sub.interval, Math.max(1, sub.intervalCount), n), amountCents: sub.amountCents, status: "paid" });
    }
    if (sub.status === "past_due" || sub.status === "expired") {
      rows.push({ key: `${sub.reference}:${paid}`, reference: sub.reference, date: addIntervals(start, sub.interval, Math.max(1, sub.intervalCount), paid), amountCents: sub.amountCents, status: "unpaid" });
    }
  }
  return rows.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, limit);
}
