import type { ReactNode } from "react";
import type { AdminActivity, AdminCharge, AdminSubscriptionRow } from "@/lib/admin/data";
import { formatUsd } from "@/lib/admin/metrics";
import { cn } from "@/lib/utils";

const DATE = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const fmt = (iso: string | null) => (iso ? DATE.format(new Date(iso)) : "—");
const cap = (s: string | null) => (s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ") : "—");

function Pill({ tone, children }: { tone: "good" | "warn" | "info" | "muted" | "bad"; children: ReactNode }) {
  const tones = {
    good: "bg-success-wash text-success ring-[#cfeadf]",
    warn: "bg-warning-wash text-warning ring-[#f6e1bb]",
    info: "bg-blue-50 text-blue-700 ring-blue-100",
    muted: "bg-wash text-muted ring-line",
    bad: "bg-danger-wash text-danger ring-[#f6cfcd]",
  } as const;
  return <span className={cn("inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-medium ring-1", tones[tone])}>{children}</span>;
}

function Table({ head, children, empty, isEmpty, columns }: { head: string[]; children: ReactNode; empty: string; isEmpty: boolean; columns: string }) {
  if (isEmpty) return <p className="rounded-2xl bg-paper px-4 py-10 text-center text-[14px] text-muted ring-1 ring-line">{empty}</p>;
  return (
    <div className="overflow-hidden rounded-2xl ring-1 ring-line">
      <div className="max-h-[520px] overflow-auto">
        <div className="min-w-[640px]">
          <div className="sticky top-0 z-10 grid gap-4 border-b border-line bg-paper px-4 py-2.5 font-mono text-[10.5px] uppercase tracking-[0.12em] text-faint" style={{ gridTemplateColumns: columns }}>
            {head.map((h, i) => (
              <span key={h} className={i === head.length - 1 ? "text-right" : undefined}>
                {h}
              </span>
            ))}
          </div>
          <ul className="divide-y divide-line">{children}</ul>
        </div>
      </div>
    </div>
  );
}

const SUB_TONE: Record<string, "good" | "warn" | "info" | "muted" | "bad"> = {
  active: "good",
  trialing: "info",
  past_due: "warn",
  canceled: "muted",
  expired: "bad",
  incomplete: "muted",
};

export function ChargesLedger({ charges }: { charges: AdminCharge[] }) {
  const columns = "120px minmax(0,1.6fr) minmax(0,0.8fr) 110px 100px";
  return (
    <Table head={["Date", "Customer", "Plan", "Status", "Amount"]} columns={columns} isEmpty={!charges.length} empty="No payments yet. They'll appear here once a subscription bills after its trial.">
      {charges.map((c) => (
        <li key={c.key} className="grid items-center gap-4 px-4 py-3 text-[13.5px]" style={{ gridTemplateColumns: columns }}>
          <span className="tabular-nums text-muted">{fmt(c.date)}</span>
          <span className="truncate">{c.email ?? "Unknown customer"}</span>
          <span className="text-muted">{cap(c.plan)}</span>
          <span>{c.status === "paid" ? <Pill tone="good">Paid</Pill> : <Pill tone="warn">Unpaid</Pill>}</span>
          <span className="text-right font-medium tabular-nums">{formatUsd(c.amountCents)}</span>
        </li>
      ))}
    </Table>
  );
}

export function SubscriptionsLedger({ subscriptions }: { subscriptions: AdminSubscriptionRow[] }) {
  const columns = "minmax(0,1.6fr) minmax(0,0.7fr) 120px 120px 130px 100px";
  return (
    <Table
      head={["Customer", "Plan", "Status", "Started", "Renews / ends", "Per month"]}
      columns={columns}
      isEmpty={!subscriptions.length}
      empty="No subscriptions yet. Every trial and plan started through Postory will show up here."
    >
      {subscriptions.map((s) => (
        <li key={s.reference} className="grid items-center gap-4 px-4 py-3 text-[13.5px]" style={{ gridTemplateColumns: columns }}>
          <span className="min-w-0">
            <span className="block truncate">{s.email ?? "Not linked to a Postory user"}</span>
            <span className="block truncate font-mono text-[11px] text-faint">{s.reference}</span>
          </span>
          <span className="text-muted">{cap(s.plan)}</span>
          <span>
            <Pill tone={SUB_TONE[s.status] ?? "muted"}>{s.status === "trialing" ? "Trial" : cap(s.status)}</Pill>
          </span>
          <span className="tabular-nums text-muted">{fmt(s.createdAt)}</span>
          <span className="tabular-nums text-muted">
            {s.status === "trialing" ? `Trial ends ${fmt(s.trialEndsAt)}` : s.endedAt ? `Ended ${fmt(s.endedAt)}` : s.cancelAtPeriodEnd ? `Ends ${fmt(s.periodEnd)}` : fmt(s.periodEnd)}
          </span>
          <span className="text-right font-medium tabular-nums">{s.monthlyCents === null ? "—" : formatUsd(s.monthlyCents)}</span>
        </li>
      ))}
    </Table>
  );
}

const KIND_LABEL: Record<string, string> = { checkout: "Checkout", plan_change: "Plan change", cancel: "Cancellation" };

export function ActivityLedger({ activity }: { activity: AdminActivity[] }) {
  const columns = "120px minmax(0,1.6fr) minmax(0,1fr) minmax(0,0.7fr) 110px";
  return (
    <Table head={["Date", "Customer", "Event", "Plan", "Result"]} columns={columns} isEmpty={!activity.length} empty="No billing activity yet.">
      {activity.map((a) => (
        <li key={a.id} className="grid items-center gap-4 px-4 py-3 text-[13.5px]" style={{ gridTemplateColumns: columns }}>
          <span className="tabular-nums text-muted">{fmt(a.createdAt)}</span>
          <span className="truncate">{a.email ?? "Deleted user"}</span>
          <span>
            {KIND_LABEL[a.kind] ?? cap(a.kind)}
            {a.kind === "checkout" && a.trial ? <span className="text-muted"> · with trial</span> : null}
          </span>
          <span className="text-muted">{cap(a.plan)}</span>
          <span className="text-right">
            {a.status === "completed" ? <Pill tone="good">Completed</Pill> : a.status === "failed" ? <Pill tone="bad">Failed</Pill> : <Pill tone="muted">Not completed</Pill>}
          </span>
        </li>
      ))}
    </Table>
  );
}
