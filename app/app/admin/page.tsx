import type { Metadata } from "next";
import { PageHeader } from "@/components/app/section";
import { BarList } from "@/components/app/analytics/bar-list";
import { ColumnChart } from "@/components/app/analytics/column-chart";
import { AdminSection } from "@/components/admin/admin-section";
import { ActivityLedger, ChargesLedger, SubscriptionsLedger } from "@/components/admin/ledgers";
import { Stat } from "@/components/admin/stat";
import { UsersTable } from "@/components/admin/users-table";
import { Notice } from "@/components/ui/notice";
import { loadAdminDashboard } from "@/lib/admin/data";
import { formatUsd } from "@/lib/admin/metrics";
import { requireAdmin } from "@/lib/auth/admin";
import { PLANS, isPlanId } from "@/lib/billing/plans";

export const metadata: Metadata = { title: "Admin" };
export const maxDuration = 60;

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

export default async function AdminPage() {
  const { user, role } = await requireAdmin();
  const data = await loadAdminDashboard();
  const { revenue, growth, usage } = data;
  const paidCharges = data.charges.filter((c) => c.status === "paid");

  return (
    <>
      <PageHeader
        eyebrow={role === "owner" ? "Owner" : "Admin"}
        title="Business at a glance"
        description={
          data.revenueSource === "handypay"
            ? "Subscriptions are read live from HandyPay each time this page loads. Only Postory staff can see it."
            : "Only Postory staff can see this page."
        }
      />

      <div className="flex flex-col gap-4">
        {data.providerNotice ? <Notice tone={data.revenueSource === "handypay" ? "info" : "warning"} title={data.providerNotice} /> : null}

        <AdminSection
          id="revenue"
          title="Revenue"
          defaultOpen
          summary={`${formatUsd(revenue.mrrCents)} MRR · ${plural(revenue.payingCount, "paying customer")} · ${plural(revenue.trialingCount, "trial")}`}
        >
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
            <Stat label="MRR" value={revenue.mrrCents} kind="usd" tone="accent" hint="Monthly recurring" />
            <Stat label="ARR" value={revenue.arrCents} kind="usd" hint="MRR × 12" />
            <Stat label="Paying" value={revenue.payingCount} hint={revenue.pastDueCount ? `${revenue.pastDueCount} past due` : "Active subscriptions"} />
            <Stat label="In trial" value={revenue.trialingCount} hint={revenue.trialPipelineCents ? `${formatUsd(revenue.trialPipelineCents)}/mo if all convert` : "No trials running"} />
            <Stat label="Collected" value={revenue.estimatedCollectedCents} kind="usd" hint="Estimated, all time" />
            <Stat label="Churned · 30d" value={revenue.churned30Count} hint={revenue.cancelingCount ? `${revenue.cancelingCount} set to cancel` : "Ended subscriptions"} />
          </div>
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <div className="rounded-2xl p-4 ring-1 ring-line">
              <p className="text-[14px] font-semibold">MRR by month</p>
              <p className="mb-5 text-[12.5px] text-muted">Recurring revenue at the end of each month (this month: today).</p>
              <ColumnChart data={revenue.monthly.map((m) => ({ label: m.label, value: Math.round(m.mrrCents / 100) }))} label="MRR by month" unit="MRR" prefix="$" height={170} />
            </div>
            <div className="rounded-2xl p-4 ring-1 ring-line">
              <p className="text-[14px] font-semibold">Plan mix</p>
              <p className="mb-5 text-[12.5px] text-muted">Paying and trialing customers by plan.</p>
              {revenue.byPlan.length ? (
                <BarList
                  unit="customers"
                  items={revenue.byPlan.map((p) => ({
                    key: p.plan,
                    label: isPlanId(p.plan) ? `${PLANS[p.plan].name} · $${PLANS[p.plan].priceMonthlyUsd}` : "Other",
                    value: p.paying + p.trialing,
                  }))}
                />
              ) : (
                <p className="py-8 text-center text-[13px] text-muted">No customers on a plan yet.</p>
              )}
              <ul className="mt-5 grid grid-cols-3 gap-2 border-t border-line pt-4 text-center">
                {revenue.monthly.slice(-3).map((m) => (
                  <li key={m.key}>
                    <p className="text-[18px] font-semibold tabular-nums">{m.newPaying}</p>
                    <p className="text-[11.5px] text-muted">new paying · {m.label}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </AdminSection>

        <AdminSection
          id="payments"
          title="Payments"
          summary={paidCharges.length ? `${plural(paidCharges.length, "payment")} · ${formatUsd(paidCharges.reduce((s, c) => s + c.amountCents, 0))} collected` : "No payments yet"}
        >
          <p className="mb-4 max-w-3xl text-[13px] leading-relaxed text-muted">
            One row per billing period a subscription has been charged for, worked out from HandyPay&apos;s subscription records (HandyPay doesn&apos;t list
            individual charges through its API). Exact receipts and payouts are in your HandyPay dashboard.
          </p>
          <ChargesLedger charges={data.charges} />
        </AdminSection>

        <AdminSection id="subscriptions" title="Subscriptions" summary={plural(data.subscriptions.length, "subscription")}>
          <SubscriptionsLedger subscriptions={data.subscriptions} />
        </AdminSection>

        <AdminSection id="activity" title="Checkout activity" summary={plural(data.activity.length, "event")}>
          <p className="mb-4 text-[13px] text-muted">Checkouts started from Postory, plan changes and cancellations — including ones people didn&apos;t finish.</p>
          <ActivityLedger activity={data.activity} />
        </AdminSection>

        <AdminSection id="users" title="Users" defaultOpen summary={`${plural(growth.total, "user")} · ${growth.last7} new this week`}>
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
            <Stat label="Users" value={growth.total} hint={`${growth.confirmed} confirmed`} />
            <Stat label="New · 7d" value={growth.last7} hint={`${growth.last30} in 30 days`} />
            <Stat label="Set up" value={growth.onboarded} hint="Finished onboarding" />
            <Stat label="Stories" value={usage.stories} hint="Created in Postory" />
            <Stat label="Published" value={usage.published} hint={`${usage.scheduled} scheduled`} />
            <Stat label="Accounts" value={usage.connectedAccounts} hint="Networks connected" />
          </div>
          <UsersTable users={data.users} canManage={role === "owner"} viewerId={user.id} />
          {role === "owner" ? (
            <p className="mt-4 text-[12.5px] text-muted">Admins can see this page. Only you can add or remove them.</p>
          ) : null}
        </AdminSection>
      </div>
    </>
  );
}
