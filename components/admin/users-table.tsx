"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Search, ShieldCheck, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { promoteToAdmin, revokeAdmin } from "@/app/_actions/admin";
import type { AdminUser } from "@/lib/admin/data";
import { cn } from "@/lib/utils";

const DATE = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const fmt = (iso: string | null) => (iso ? DATE.format(new Date(iso)) : "—");

type Filter = "all" | "paying" | "trial" | "none" | "staff";

function billingOf(u: AdminUser): { label: string; tone: string; filter: Filter } {
  const plan = u.plan ? u.plan.charAt(0).toUpperCase() + u.plan.slice(1) : null;
  switch (u.status) {
    case "trialing":
      return { label: `${plan ?? "Trial"} trial · ends ${fmt(u.trialEndsAt)}`, tone: "bg-blue-50 text-blue-700 ring-blue-100", filter: "trial" };
    case "active":
      return { label: u.cancelAtPeriodEnd ? `${plan} · cancels ${fmt(u.periodEnd)}` : (plan ?? "Active"), tone: "bg-success-wash text-success ring-[#cfeadf]", filter: "paying" };
    case "past_due":
      return { label: `${plan ?? ""} · past due`.trim(), tone: "bg-warning-wash text-warning ring-[#f6e1bb]", filter: "paying" };
    case "canceled":
    case "expired":
      return { label: "Ended", tone: "bg-wash text-muted ring-line", filter: "none" };
    default:
      return { label: "No plan", tone: "bg-wash text-muted ring-line", filter: "none" };
  }
}

export function UsersTable({ users, canManage, viewerId }: { users: AdminUser[]; canManage: boolean; viewerId: string }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const rows = useMemo(
    () =>
      users.map((u) => ({ user: u, billing: billingOf(u) })).filter(({ user, billing }) => {
        if (filter === "staff" && !user.role) return false;
        if (filter !== "all" && filter !== "staff" && billing.filter !== filter) return false;
        const q = query.trim().toLowerCase();
        if (!q) return true;
        return [user.email, user.name, user.businessName].some((v) => v?.toLowerCase().includes(q));
      }),
    [users, query, filter],
  );

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: users.length, paying: 0, trial: 0, none: 0, staff: 0 };
    for (const u of users) {
      c[billingOf(u).filter] += 1;
      if (u.role) c.staff += 1;
    }
    return c;
  }, [users]);

  const FILTERS: { id: Filter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "paying", label: "Paying" },
    { id: "trial", label: "In trial" },
    { id: "none", label: "No plan" },
    { id: "staff", label: "Admins" },
  ];

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative block sm:w-72">
          <span className="sr-only">Search users</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email or business"
            className="h-10 w-full rounded-xl bg-surface pl-9 pr-3 text-[14px] shadow-hairline placeholder:text-faint focus:shadow-[0_0_0_1px_var(--color-blue-500),0_0_0_4px_rgb(47_91_255/0.14)] focus:outline-none"
          />
        </label>
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1 scrollbar-none" role="tablist" aria-label="Filter users">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "relative flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors",
                filter === f.id ? "text-white" : "text-muted hover:text-ink",
              )}
            >
              {filter === f.id ? <motion.span layoutId="admin-user-filter" className="absolute inset-0 rounded-full bg-ink" transition={{ type: "spring", stiffness: 420, damping: 34 }} /> : null}
              <span className="relative">{f.label}</span>
              <span className={cn("relative tabular-nums", filter === f.id ? "text-white/60" : "text-faint")}>{counts[f.id]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl ring-1 ring-line">
        <div className="hidden grid-cols-[minmax(0,1.6fr)_minmax(0,1.1fr)_110px_110px_150px] gap-4 bg-paper px-4 py-2.5 font-mono text-[10.5px] uppercase tracking-[0.12em] text-faint lg:grid">
          <span>User</span>
          <span>Plan</span>
          <span>Joined</span>
          <span>Last seen</span>
          <span className="text-right">Access</span>
        </div>
        <ul className="divide-y divide-line">
          <AnimatePresence initial={false}>
            {rows.map(({ user, billing }) => (
              <motion.li
                key={user.id}
                layout="position"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.12 } }}
                transition={{ type: "spring", stiffness: 380, damping: 34 }}
                className="grid grid-cols-1 gap-2 px-4 py-3.5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1.1fr)_110px_110px_150px] lg:items-center lg:gap-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-blue-50 text-[13px] font-semibold uppercase text-blue-700">
                    {(user.name || user.email || "?").charAt(0)}
                  </span>
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 truncate text-[14px] font-medium">
                      <span className="truncate">{user.name || user.email?.split("@")[0] || "Unnamed"}</span>
                      {user.role ? (
                        <span className="shrink-0 rounded-full bg-ink px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">{user.role}</span>
                      ) : null}
                    </p>
                    <p className="truncate text-[12.5px] text-muted">
                      {user.email}
                      {user.businessName ? ` · ${user.businessName}` : ""}
                      {!user.confirmed ? " · unconfirmed" : !user.onboarded ? " · setting up" : ""}
                    </p>
                  </div>
                </div>
                <div className="lg:min-w-0">
                  <span className={cn("inline-flex max-w-full truncate rounded-full px-2.5 py-1 text-[12px] font-medium ring-1", billing.tone)}>{billing.label}</span>
                </div>
                <p className="text-[13px] text-muted">
                  <span className="lg:hidden">Joined </span>
                  {fmt(user.createdAt)}
                </p>
                <p className="text-[13px] text-muted">
                  <span className="lg:hidden">Last seen </span>
                  {fmt(user.lastSignInAt)}
                </p>
                <div className="flex lg:justify-end">
                  {canManage && user.id !== viewerId && user.role !== "owner" ? (
                    user.role === "admin" ? (
                      <ConfirmButton
                        size="sm"
                        variant="ghost"
                        icon={<ShieldOff className="size-3.5" />}
                        title={`Remove admin access for ${user.email}?`}
                        description="They'll keep their own Postory account, but won't see users, payments or revenue any more."
                        confirmLabel="Remove access"
                        onConfirm={async () => {
                          const result = await revokeAdmin(user.id);
                          if (result.ok) toast.success("Admin access removed.");
                          else toast.error(result.error.message);
                        }}
                      >
                        Remove admin
                      </ConfirmButton>
                    ) : (
                      <ConfirmButton
                        size="sm"
                        variant="secondary"
                        confirmVariant="primary"
                        icon={<ShieldCheck className="size-3.5" />}
                        disabled={!user.confirmed}
                        title={`Make ${user.email} an admin?`}
                        description="Admins can see every user, all payments and revenue. Only you can add or remove admins."
                        confirmLabel="Make admin"
                        onConfirm={async () => {
                          const result = await promoteToAdmin(user.id);
                          if (result.ok) toast.success(`${user.email} is now an admin.`);
                          else toast.error(result.error.message);
                        }}
                      >
                        Make admin
                      </ConfirmButton>
                    )
                  ) : null}
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
        {!rows.length ? <p className="px-4 py-10 text-center text-[14px] text-muted">No users match.</p> : null}
      </div>
    </div>
  );
}
