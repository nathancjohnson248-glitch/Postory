import type { Metadata } from "next";
import { Suspense } from "react";
import { KeyRound, ShieldCheck, Store, ThumbsUp } from "lucide-react";
import { NetworkList } from "@/components/app/network-list";
import { PageHeader } from "@/components/app/section";
import { ConnectionReturnToast } from "@/components/onboarding/return-notices";
import { requireAppAccess } from "@/lib/auth/access";
import { getNetworkStates } from "@/lib/data/social";
import { getEntitlements } from "@/lib/entitlements";
import { getSocialReadiness } from "@/lib/social/service";
import { PLATFORMS } from "@/lib/social/platforms";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Connections" };

const NOTES = [
  { icon: KeyRound, title: "You sign in on the network itself", body: "Postory never sees your password. Bluesky is the one exception: it uses an app password you make in Bluesky's settings and can revoke any time." },
  { icon: Store, title: "Business accounts for Meta", body: "Instagram needs a Business or Creator account, and Facebook posts go to a Page you manage, not a personal profile." },
  { icon: ThumbsUp, title: "Nothing posts on its own", body: "Connecting only lets Postory publish what you approve, when you press Publish or a time you set comes round." },
  { icon: ShieldCheck, title: "Disconnect whenever you like", body: "Your stories and posts stay in your library. To revoke access completely, remove Postory on the network's connected-apps page too." },
];

export default async function ConnectionsPage() {
  const { user } = await requireAppAccess();
  const [networks, readiness, entitlements] = await Promise.all([getNetworkStates(user.id), getSocialReadiness(user.id), getEntitlements(user.id)]);

  const accounts = networks.flatMap((n) => n.accounts);
  const connected = accounts.filter((a) => a.status === "connected").length;
  const attention = accounts.filter((a) => a.status === "reconnect_required" || a.status === "error").length;
  const limit = entitlements.limits.socialAccounts;

  const stats = [
    { label: "Connected", value: String(connected), tone: connected ? "text-success" : "text-ink" },
    { label: "Need attention", value: String(attention), tone: attention ? "text-warning" : "text-ink" },
    { label: "Your plan allows", value: limit === null ? "Unlimited" : String(limit), tone: "text-ink" },
    { label: "Networks available", value: String(PLATFORMS.length), tone: "text-ink" },
  ];

  return (
    <>
      <Suspense>
        <ConnectionReturnToast />
      </Suspense>
      <PageHeader
        eyebrow="Connections"
        title="Your networks"
        description="Connect the accounts Postory should post to. One story goes out to every network you connect, each version written for that network."
      />

      <dl className="fade-rise mb-8 grid grid-cols-2 gap-px overflow-hidden rounded-3xl bg-line shadow-soft ring-1 ring-line sm:grid-cols-4" style={{ animationDelay: "0.12s" }}>
        {stats.map((s) => (
          <div key={s.label} className="bg-surface px-5 py-4">
            <dt className="text-[12.5px] text-muted">{s.label}</dt>
            <dd className={cn("mt-1 font-display text-[30px] leading-none tracking-[-0.02em] tabular-nums", s.tone)}>{s.value}</dd>
          </div>
        ))}
      </dl>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <NetworkList rows={networks} readiness={readiness.ready ? { ready: true } : { ready: false, message: readiness.message }} returnPath="/app/connections" />

        <aside className="flex flex-col gap-3 lg:sticky lg:top-10 lg:self-start">
          <h2 className="px-1 text-[13px] font-semibold text-ink-soft">Before you connect</h2>
          <ul className="flex flex-col gap-2">
            {NOTES.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-3 rounded-2xl bg-surface p-4 ring-1 ring-line">
                <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600">
                  <Icon className="size-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-[13.5px] font-semibold tracking-[-0.01em]">{title}</p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </>
  );
}
