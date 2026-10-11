import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, PenLine, Plug } from "lucide-react";
import { PlatformIcon } from "@/components/brand/platform-icon";
import { PostRow } from "@/components/app/post-row";
import { PageHeader, Section } from "@/components/app/section";
import { QuickCreate } from "@/components/app/quick-create";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Notice } from "@/components/ui/notice";
import { requireOnboardedUser } from "@/lib/auth/session";
import { getEntitlements } from "@/lib/entitlements";
import { getHomeData } from "@/lib/data/home";
import { getNetworkStates } from "@/lib/data/social";
import { PLATFORM_META, type Platform } from "@/lib/social/platforms";
import { formatRelativeDay, greeting, safeTimeZone } from "@/lib/time";
import { firstName, pluralize } from "@/lib/utils";

export default async function HomePage() {
  const { user, profile } = await requireOnboardedUser();
  const tz = safeTimeZone(profile.timezone);
  const [data, networks, entitlements] = await Promise.all([getHomeData(user.id), getNetworkStates(user.id), getEntitlements(user.id)]);
  const name = firstName(profile.name);
  const connected = networks.flatMap((n) => n.accounts.map((a) => ({ ...a, platform: n.platform })));

  const signals = [
    data.counts.review ? { icon: PenLine, text: `${pluralize(data.counts.review, "post")} ${data.counts.review === 1 ? "needs" : "need"} your approval`, href: "/app/library?view=posts&status=review", tone: "text-blue-700 bg-blue-50 ring-blue-100" } : null,
    data.counts.week ? { icon: CalendarClock, text: `${pluralize(data.counts.week, "post")} scheduled this week`, href: "/app/calendar?view=agenda", tone: "text-ink-soft bg-surface ring-line" } : null,
    data.counts.attention ? { icon: Plug, text: `${pluralize(data.counts.attention, "network")} ${data.counts.attention === 1 ? "needs" : "need"} attention`, href: "/app/settings#accounts", tone: "text-warning bg-warning-wash ring-[#f6e1bb]" } : null,
    data.failed.length ? { icon: AlertTriangle, text: `${pluralize(data.failed.length, "post")} failed to publish`, href: "/app/library?view=posts&status=failed", tone: "text-danger bg-danger-wash ring-[#f6cfcd]" } : null,
  ].filter((s): s is NonNullable<typeof s> => s !== null);

  return (
    <>
      <PageHeader
        title={
          <>
            {greeting(tz)}
            {name ? <span className="italic">, {name}.</span> : "."}
          </>
        }
        description="Here's what's moving."
        actions={
          <ButtonLink href="/app/create" variant="accent" size="lg" icon={<PenLine className="size-4" />}>
            Create story
          </ButtonLink>
        }
      />

      {!entitlements.active ? (
        <Notice
          tone="warning"
          title={entitlements.reason === "trial_ended" ? "Your trial has ended." : "You don't have a plan yet."}
          className="mb-6"
          action={<ButtonLink href="/app/billing" size="sm" variant="secondary">See plans</ButtonLink>}
        >
          You can look around, but generating and publishing posts needs a plan. Your stories and posts are kept either way.
        </Notice>
      ) : null}

      <div className="mb-8 flex flex-wrap gap-2">
        {signals.length ? (
          signals.map((s) => (
            <Link key={s.text} href={s.href} className={`inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-[13px] font-medium ring-1 ring-inset transition-transform hover:-translate-y-px ${s.tone}`}>
              <s.icon className="size-4" aria-hidden />
              {s.text}
            </Link>
          ))
        ) : (
          <p className="inline-flex h-9 items-center gap-2 rounded-full bg-surface px-3.5 text-[13px] text-muted ring-1 ring-line">
            <CheckCircle2 className="size-4 text-success" aria-hidden />
            Nothing needs you right now.
          </p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <Section title="Needs your approval" description="Nothing publishes until you approve it." href="/app/library?view=posts&status=review">
            {data.needsReview.length ? (
              <div className="flex flex-col">
                {data.needsReview.map((post) => (
                  <PostRow key={post.id} post={post} />
                ))}
              </div>
            ) : (
              <p className="px-4 pb-5 pt-1 text-sm text-muted">You&apos;re all caught up. New posts land here for review.</p>
            )}
          </Section>

          <Section title="Up next" description="What's going out, in your timezone." href="/app/calendar">
            {data.upcoming.length ? (
              <div className="flex flex-col">
                {data.upcoming.map((post) => (
                  <PostRow key={post.id} post={post} when={post.scheduledFor ? formatRelativeDay(post.scheduledFor, tz) : null} />
                ))}
              </div>
            ) : (
              <p className="px-4 pb-5 pt-1 text-sm text-muted">Your calendar is clear. Approve a post and schedule it to fill the week.</p>
            )}
          </Section>

          <Section title="Recently published" href="/app/library?view=posts&status=published">
            {data.published.length ? (
              <div className="flex flex-col">
                {data.published.map((post) => (
                  <PostRow key={post.id} post={post} when={post.publishedAt ? formatRelativeDay(post.publishedAt, tz) : null} />
                ))}
              </div>
            ) : (
              <p className="px-4 pb-5 pt-1 text-sm text-muted">Nothing published yet. Your first post is one story away.</p>
            )}
          </Section>
        </div>

        <div className="flex flex-col gap-6">
          <QuickCreate />

          <Section title="Recent stories" href="/app/library">
            {data.stories.length ? (
              <ul className="flex flex-col">
                {data.stories.map((story) => {
                  const posts = (story.story_posts ?? []) as { platform: string; status: string }[];
                  return (
                    <li key={story.id}>
                      <Link href={`/app/library/${story.id}`} className="block rounded-2xl px-3 py-3 transition-colors hover:bg-wash">
                        <p className="truncate text-[14px] font-semibold">{story.title}</p>
                        <p className="mt-0.5 line-clamp-1 text-[13px] text-muted">{story.source_text}</p>
                        <div className="mt-2 flex items-center gap-1">
                          {posts.slice(0, 8).map((p, i) => (
                            <PlatformIcon key={`${p.platform}-${i}`} platform={p.platform as Platform} className="size-3.5 text-faint" />
                          ))}
                          {!posts.length ? <span className="text-xs text-faint">{story.status === "processing" ? "Writing…" : "No posts yet"}</span> : null}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState
                className="m-2 border-0 bg-wash/60 py-10"
                title="Nothing here yet."
                description="Tell Postory what happened in your business and we'll turn it into your next social story."
                action={<ButtonLink href="/app/create" size="sm">Create a story</ButtonLink>}
              />
            )}
          </Section>

          <Section title="Networks" href="/app/settings#accounts" hrefLabel="Manage">
            {connected.length ? (
              <ul className="flex flex-col gap-0.5 px-2 pb-2">
                {connected.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 rounded-xl px-2 py-2">
                    <PlatformIcon platform={a.platform} tile className="size-7 rounded-lg" />
                    <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{a.username ?? a.displayName ?? PLATFORM_META[a.platform].name}</span>
                    <span className={`text-xs ${a.status === "connected" ? "text-success" : "text-warning"}`}>
                      {a.status === "connected" ? "Connected" : "Reconnect"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-4 pb-5">
                <p className="text-sm text-muted">Connect your first network so approved posts can go out.</p>
                <Link href="/app/settings#accounts" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline">
                  Connect a network <ArrowRight className="size-3.5" />
                </Link>
              </div>
            )}
          </Section>
        </div>
      </div>
    </>
  );
}
