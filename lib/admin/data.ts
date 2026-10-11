import "server-only";

import { handypay, type AdminSubscription } from "@/lib/billing/handypay";
import { PLANS, isPlanId } from "@/lib/billing/plans";
import { log } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { isOwnerEmail } from "@/lib/auth/admin";
import { estimatedCharges, summarizeRevenue, type EstimatedCharge, type RevenueSubscription, type RevenueSummary } from "./metrics";

/**
 * Everything the admin area shows, loaded with the service role. Only ever
 * called after requireAdmin() has confirmed who is asking.
 */

export type AdminUser = {
  id: string;
  email: string | null;
  name: string | null;
  businessName: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  confirmed: boolean;
  onboarded: boolean;
  plan: string | null;
  status: string | null;
  trialEndsAt: string | null;
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  role: "owner" | "admin" | null;
};

export type AdminSubscriptionRow = {
  reference: string;
  userId: string | null;
  email: string | null;
  plan: string | null;
  status: string;
  amountCents: number | null;
  monthlyCents: number | null;
  interval: string;
  createdAt: string | null;
  trialEndsAt: string | null;
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  endedAt: string | null;
};

export type AdminCharge = { key: string; date: string; email: string | null; plan: string | null; amountCents: number; status: EstimatedCharge["status"] };

export type AdminActivity = { id: string; createdAt: string; email: string | null; kind: string; plan: string | null; status: string; trial: boolean };

export type AdminDashboard = {
  generatedAt: string;
  revenue: RevenueSummary;
  revenueSource: "handypay" | "mirror";
  providerNotice: string | null;
  subscriptions: AdminSubscriptionRow[];
  charges: AdminCharge[];
  activity: AdminActivity[];
  users: AdminUser[];
  usage: { stories: number; published: number; scheduled: number; connectedAccounts: number };
  growth: { total: number; last7: number; last30: number; onboarded: number; confirmed: number };
};

const iso = (d: Date | null) => (d ? d.toISOString() : null);

async function listAuthUsers() {
  const admin = createAdminClient();
  const users: { id: string; email: string | null; created_at: string; last_sign_in_at: string | null; email_confirmed_at: string | null }[] = [];
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    for (const u of data.users) {
      users.push({ id: u.id, email: u.email ?? null, created_at: u.created_at, last_sign_in_at: u.last_sign_in_at ?? null, email_confirmed_at: u.email_confirmed_at ?? null });
    }
    if (data.users.length < 1000) break;
  }
  return users;
}

export async function loadAdminDashboard(now = new Date()): Promise<AdminDashboard> {
  const admin = createAdminClient();

  const [authUsers, profilesRes, localSubsRes, adminsRes, eventsRes, stories, published, scheduled, connectedAccounts] = await Promise.all([
    listAuthUsers(),
    admin.from("profiles").select("id,name,business_name,onboarding_completed"),
    admin.from("subscriptions").select("*"),
    admin.from("admin_users").select("user_id"),
    admin.from("billing_events").select("id,created_at,user_id,kind,plan,status,detail").order("created_at", { ascending: false }).limit(300),
    admin.from("stories").select("id", { count: "exact", head: true }),
    admin.from("story_posts").select("id", { count: "exact", head: true }).eq("status", "published"),
    admin.from("story_posts").select("id", { count: "exact", head: true }).eq("status", "scheduled"),
    admin.from("social_accounts").select("id", { count: "exact", head: true }).eq("status", "connected"),
  ]);

  const profiles = new Map((profilesRes.data ?? []).map((p) => [p.id, p]));
  const localSubs = localSubsRes.data ?? [];
  const localByUser = new Map(localSubs.map((s) => [s.user_id, s]));
  const userBySubscription = new Map(localSubs.filter((s) => s.provider_subscription_id).map((s) => [s.provider_subscription_id as string, s.user_id]));
  const userByCustomer = new Map(localSubs.filter((s) => s.provider_customer_id).map((s) => [s.provider_customer_id as string, s.user_id]));
  const admins = new Set((adminsRes.data ?? []).map((a) => a.user_id));
  const emailById = new Map(authUsers.map((u) => [u.id, u.email]));

  // Subscriptions: HandyPay is the source of truth; fall back to Postory's mirror.
  let providerSubs: AdminSubscription[] | null = null;
  let providerNotice: string | null = null;
  if (handypay.isConfigured()) {
    try {
      const result = await handypay.listSubscriptions();
      providerSubs = result.subscriptions;
      if (result.truncated) providerNotice = "Showing the most recent 1,000 HandyPay subscriptions.";
    } catch (error) {
      log.warn("admin: handypay list failed", { operation: "admin.subscriptions", provider: "handypay" }, error);
      providerNotice = "HandyPay couldn't be reached, so these figures come from Postory's last synced copy.";
    }
  } else {
    providerNotice = "HandyPay isn't configured, so these figures come from Postory's own records.";
  }

  type Linked = RevenueSubscription & { reference: string; userId: string | null; endedAtRaw: Date | null };
  let linked: Linked[];
  if (providerSubs) {
    linked = providerSubs
      .map((s) => ({ ...s, userId: s.userId ?? userBySubscription.get(s.reference) ?? (s.customerReference ? userByCustomer.get(s.customerReference) : undefined) ?? null }))
      // Only subscriptions that belong to Postory (the HandyPay account may sell other things).
      .filter((s) => s.taggedForPostory || s.userId)
      .map((s) => ({ ...s, endedAtRaw: s.endedAt }));
  } else {
    linked = localSubs.map((s) => {
      const cents = isPlanId(s.plan) ? PLANS[s.plan].priceMonthlyUsd * 100 : null;
      return {
        reference: s.provider_subscription_id ?? s.id,
        userId: s.user_id,
        status: (["trialing", "active", "past_due", "canceled", "expired", "incomplete"].includes(s.status) ? s.status : "incomplete") as RevenueSubscription["status"],
        plan: s.plan,
        amountCents: cents,
        monthlyCents: cents,
        interval: "month",
        intervalCount: 1,
        createdAt: new Date(s.created_at),
        trialEndsAt: s.trial_ends_at ? new Date(s.trial_ends_at) : null,
        canceledAt: s.canceled_at ? new Date(s.canceled_at) : null,
        endedAt: null,
        endedAtRaw: null,
        currentPeriodEnd: s.current_period_end ? new Date(s.current_period_end) : null,
        cancelAtPeriodEnd: s.cancel_at_period_end,
      };
    });
  }

  const subscriptions: AdminSubscriptionRow[] = linked
    .map((s) => ({
      reference: s.reference,
      userId: s.userId,
      email: s.userId ? (emailById.get(s.userId) ?? null) : null,
      plan: s.plan,
      status: s.status,
      amountCents: s.amountCents,
      monthlyCents: s.monthlyCents,
      interval: s.interval,
      createdAt: iso(s.createdAt),
      trialEndsAt: iso(s.trialEndsAt),
      periodEnd: iso(s.currentPeriodEnd),
      cancelAtPeriodEnd: s.cancelAtPeriodEnd,
      endedAt: iso(s.endedAtRaw),
    }))
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));

  const subByRef = new Map(linked.map((s) => [s.reference, s]));
  const charges: AdminCharge[] = estimatedCharges(linked, now).map((c) => {
    const sub = subByRef.get(c.reference);
    return { key: c.key, date: c.date.toISOString(), email: sub?.userId ? (emailById.get(sub.userId) ?? null) : null, plan: sub?.plan ?? null, amountCents: c.amountCents, status: c.status };
  });

  const activity: AdminActivity[] = (eventsRes.data ?? []).map((e) => ({
    id: e.id,
    createdAt: e.created_at,
    email: emailById.get(e.user_id) ?? null,
    kind: e.kind,
    plan: e.plan,
    status: e.status,
    trial: Number((e.detail as { trialDays?: number } | null)?.trialDays ?? 0) > 0,
  }));

  const users: AdminUser[] = authUsers
    .map((u) => {
      const p = profiles.get(u.id);
      const s = localByUser.get(u.id);
      return {
        id: u.id,
        email: u.email,
        name: p?.name ?? null,
        businessName: p?.business_name ?? null,
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at,
        confirmed: Boolean(u.email_confirmed_at),
        onboarded: Boolean(p?.onboarding_completed),
        plan: s?.plan ?? null,
        status: s?.status ?? null,
        trialEndsAt: s?.trial_ends_at ?? null,
        periodEnd: s?.current_period_end ?? null,
        cancelAtPeriodEnd: Boolean(s?.cancel_at_period_end),
        role: isOwnerEmail(u.email) && u.email_confirmed_at ? ("owner" as const) : admins.has(u.id) ? ("admin" as const) : null,
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const day = 24 * 60 * 60 * 1000;
  const since = (days: number) => users.filter((u) => now.getTime() - new Date(u.createdAt).getTime() <= days * day).length;

  return {
    generatedAt: now.toISOString(),
    revenue: summarizeRevenue(linked, now),
    revenueSource: providerSubs ? "handypay" : "mirror",
    providerNotice,
    subscriptions,
    charges,
    activity,
    users,
    usage: { stories: stories.count ?? 0, published: published.count ?? 0, scheduled: scheduled.count ?? 0, connectedAccounts: connectedAccounts.count ?? 0 },
    growth: { total: users.length, last7: since(7), last30: since(30), onboarded: users.filter((u) => u.onboarded).length, confirmed: users.filter((u) => u.confirmed).length },
  };
}
