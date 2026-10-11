import type { Metadata } from "next";
import Link from "next/link";
import { Lock } from "lucide-react";
import { PlatformIcon } from "@/components/brand/platform-icon";
import { BarList } from "@/components/app/analytics/bar-list";
import { ColumnChart } from "@/components/app/analytics/column-chart";
import { PageHeader, Section } from "@/components/app/section";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Notice } from "@/components/ui/notice";
import { requireAppAccess } from "@/lib/auth/access";
import { getAnalytics } from "@/lib/data/analytics";
import { getEntitlements } from "@/lib/entitlements";
import { PLATFORM_META, type Platform } from "@/lib/social/platforms";
import { safeTimeZone } from "@/lib/time";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Analytics" };

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const { user, profile } = await requireAppAccess();
  const { range } = await searchParams;
  const tz = safeTimeZone(profile.timezone);
  const rangeDays = range === "90" ? 90 : 30;
  const [data, entitlements] = await Promise.all([getAnalytics(user.id, tz, rangeDays), getEntitlements(user.id)]);
  const advanced = entitlements.active && entitlements.features.advancedAnalytics;

  return (
    <>
      <PageHeader
        title="Analytics"
        description="What went out, where, and how your publishing is trending."
        actions={
          <div className="inline-flex rounded-xl bg-wash p-0.5 text-[13px] font-medium">
            {[30, 90].map((d) => (
              <Link
                key={d}
                href={d === 30 ? "/app/analytics" : "/app/analytics?range=90"}
                className={cn("rounded-[10px] px-3.5 py-1.5 transition-all", rangeDays === d ? "bg-surface text-ink shadow-hairline" : "text-muted hover:text-ink")}
              >
                {d} days
              </Link>
            ))}
          </div>
        }
      />

      {data.totals.published === 0 && data.totals.stories === 0 ? (
        <EmptyState
          title="No results yet."
          description="Once your posts go out, Postory shows what you published, where, and which stories travelled furthest."
          action={<ButtonLink href="/app/create">Create a story</ButtonLink>}
        />
      ) : (
        <div className="flex flex-col gap-6">
          <section className="rounded-3xl bg-ink p-7 text-white shadow-lift sm:p-9">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/50">Last {rangeDays} days</p>
            <p className="mt-4 text-[56px] font-semibold leading-none tracking-[-0.04em] tabular-nums sm:text-[72px]">{data.totals.published}</p>
            <p className="mt-2 text-[15px] text-white/70">posts published</p>
            {data.headlines.length ? (
              <ul className="mt-7 grid grid-cols-1 gap-2 border-t border-white/10 pt-6 sm:grid-cols-2">
                {data.headlines.slice(1).map((h) => (
                  <li key={h} className="text-[15px] leading-snug text-white/90">
                    {h}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <Section title="Posts published per week" description="Last 8 weeks, in your timezone.">
              <div className="px-4 pb-5 pt-4">
                <ColumnChart data={data.weekly} label="Posts published per week" unit="posts" />
              </div>
            </Section>
            <Section title="By network" description={`Published in the last ${rangeDays} days.`}>
              <div className="px-4 pb-5 pt-3">
                {data.byNetwork.length ? (
                  <BarList
                    unit="posts"
                    items={data.byNetwork.map((n) => ({
                      key: n.platform,
                      label: (
                        <>
                          <PlatformIcon platform={n.platform} className="size-3.5" />
                          {PLATFORM_META[n.platform].name}
                        </>
                      ),
                      value: n.count,
                    }))}
                  />
                ) : (
                  <p className="text-sm text-muted">Nothing published in this period.</p>
                )}
              </div>
            </Section>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Section title="Stories that travelled furthest" description="By number of networks published to.">
              {data.topStories.length ? (
                <ul className="flex flex-col px-2 pb-2">
                  {data.topStories.map((s) => (
                    <li key={s.storyId}>
                      <Link href={`/app/library/${s.storyId}`} className="flex items-center justify-between gap-3 rounded-2xl px-3 py-3 transition-colors hover:bg-wash">
                        <span className="truncate text-[14px] font-medium">{s.title}</span>
                        <span className="flex shrink-0 gap-1">
                          {s.networks.map((p) => (
                            <PlatformIcon key={p} platform={p as Platform} className="size-3.5 text-ink-soft" />
                          ))}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-4 pb-5 text-sm text-muted">No published stories in this period.</p>
              )}
            </Section>
            <Section title="Review" description="How Postory's drafts fared with you.">
              <dl className="grid grid-cols-3 gap-2 px-4 pb-5 pt-3">
                {[
                  { label: "Stories", value: data.totals.stories },
                  { label: "Approved", value: data.totals.accepted },
                  { label: "Rejected", value: data.totals.rejected },
                ].map((s) => (
                  <div key={s.label} className="rounded-2xl bg-wash px-4 py-3">
                    <dt className="text-[12.5px] text-muted">{s.label}</dt>
                    <dd className="mt-1 text-2xl font-semibold tabular-nums tracking-[-0.02em]">{s.value}</dd>
                  </div>
                ))}
              </dl>
            </Section>
          </div>

          {advanced ? (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <Section title="Days you publish">
                <div className="px-4 pb-5 pt-4">
                  <ColumnChart data={data.advanced.weekdays} label="Posts published by weekday" unit="posts" height={140} highlightLast={false} />
                </div>
              </Section>
              <Section title="Time of day">
                <div className="px-4 pb-5 pt-4">
                  <BarList unit="posts" items={data.advanced.dayparts.map((d) => ({ key: d.label, label: d.label, value: d.value }))} />
                </div>
              </Section>
              <Section title="Angles that shipped">
                <div className="px-4 pb-5 pt-4">
                  {data.advanced.byAngle.length ? (
                    <BarList unit="posts" items={data.advanced.byAngle.map((a) => ({ key: a.angle, label: <span className="truncate">{a.angle}</span>, value: a.count }))} />
                  ) : (
                    <p className="text-sm text-muted">No angles recorded yet.</p>
                  )}
                </div>
              </Section>
            </div>
          ) : (
            <div className="flex flex-col items-start gap-3 rounded-3xl bg-surface p-6 shadow-soft ring-1 ring-line sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <Lock className="mt-0.5 size-4 text-faint" aria-hidden />
                <div>
                  <p className="text-[14px] font-semibold">Advanced analytics</p>
                  <p className="text-[13px] text-muted">Which days, times and angles you publish on. Included with Pro and Max.</p>
                </div>
              </div>
              <ButtonLink href="/app/billing" size="sm" variant="secondary">
                See plans
              </ButtonLink>
            </div>
          )}
        </div>
      )}

      <Notice tone="info" title="Engagement numbers aren't available yet." className="mt-6">
        Followers, impressions and likes come from each network&apos;s analytics. Postory&apos;s publishing provider doesn&apos;t report them yet, so
        this page only shows what Postory knows for certain. Nothing here is estimated.
      </Notice>
    </>
  );
}
