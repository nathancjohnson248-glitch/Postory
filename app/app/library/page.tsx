import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { PlatformIcon } from "@/components/brand/platform-icon";
import { PostRow } from "@/components/app/post-row";
import { PageHeader } from "@/components/app/section";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAppAccess } from "@/lib/auth/access";
import { reconcileQuietly } from "@/lib/data/home";
import { listPosts } from "@/lib/data/posts";
import { STATUS_LABEL, STATUS_TONE, type PostStatus } from "@/lib/posts/state-machine";
import { createClient } from "@/lib/supabase/server";
import type { Platform } from "@/lib/social/platforms";
import { formatInZone, formatRelativeDay, safeTimeZone } from "@/lib/time";
import { cn, truncate } from "@/lib/utils";

export const metadata: Metadata = { title: "Library" };

const STORY_FILTERS = [
  { id: "all", label: "All stories" },
  { id: "review", label: "Needs review" },
  { id: "drafts", label: "Drafts" },
  { id: "scheduled", label: "Scheduled" },
  { id: "published", label: "Published" },
  { id: "archived", label: "Archived" },
] as const;

const POST_FILTERS: { id: string; label: string; statuses: PostStatus[] }[] = [
  { id: "review", label: "Needs review", statuses: ["awaiting_review", "draft"] },
  { id: "approved", label: "Approved", statuses: ["approved"] },
  { id: "scheduled", label: "Scheduled", statuses: ["scheduled"] },
  { id: "published", label: "Published", statuses: ["published"] },
  { id: "failed", label: "Failed", statuses: ["failed"] },
  { id: "rejected", label: "Rejected", statuses: ["rejected"] },
];

const DOT: Record<string, string> = {
  neutral: "bg-faint",
  blue: "bg-blue-500",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  ink: "bg-ink",
};

function escapeLike(q: string) {
  return q.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export default async function LibraryPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { user, profile } = await requireAppAccess();
  const params = await searchParams;
  const view = params.view === "posts" ? "posts" : "stories";
  const q = (params.q ?? "").trim().slice(0, 100);
  const tz = safeTimeZone(profile.timezone);
  await reconcileQuietly(user.id);

  const tabs = (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="inline-flex w-fit rounded-xl bg-wash p-0.5 text-[13px] font-medium">
        {(["stories", "posts"] as const).map((v) => (
          <Link
            key={v}
            href={v === "stories" ? "/app/library" : "/app/library?view=posts&status=review"}
            className={cn("rounded-[10px] px-3.5 py-1.5 capitalize transition-all", view === v ? "bg-surface text-ink shadow-hairline" : "text-muted hover:text-ink")}
            aria-current={view === v ? "page" : undefined}
          >
            {v}
          </Link>
        ))}
      </div>
      {view === "stories" ? (
        <form className="relative w-full sm:w-80" role="search">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" aria-hidden />
          <label htmlFor="library-search" className="sr-only">
            Search stories and posts
          </label>
          <input
            id="library-search"
            name="q"
            defaultValue={q}
            placeholder="Search stories and posts"
            className="h-10 w-full rounded-xl bg-surface pl-10 pr-3 text-[14px] shadow-hairline placeholder:text-faint focus:outline-none focus:shadow-[0_0_0_1px_var(--color-blue-500),0_0_0_4px_rgb(47_91_255/0.12)]"
          />
        </form>
      ) : null}
    </div>
  );

  if (view === "posts") {
    const filter = POST_FILTERS.find((f) => f.id === params.status) ?? POST_FILTERS[0];
    const posts = await listPosts(user.id, {
      statuses: filter.statuses,
      limit: 100,
      order: filter.id === "scheduled" ? "scheduled" : filter.id === "published" ? "published" : "updated",
    });
    return (
      <>
        <PageHeader title="Library" description="Every story and every post, in one place." />
        {tabs}
        <nav aria-label="Post status" className="scrollbar-none -mx-1 mb-6 flex gap-1 overflow-x-auto px-1">
          {POST_FILTERS.map((f) => (
            <Link
              key={f.id}
              href={`/app/library?view=posts&status=${f.id}`}
              className={cn("shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors", f.id === filter.id ? "bg-ink text-white" : "text-muted hover:bg-wash hover:text-ink")}
            >
              {f.label}
            </Link>
          ))}
        </nav>
        {posts.length ? (
          <div className="rounded-3xl bg-surface p-2 shadow-soft ring-1 ring-line">
            {posts.map((p) => (
              <PostRow
                key={p.id}
                post={p}
                when={
                  p.status === "scheduled" && p.scheduledFor
                    ? formatRelativeDay(p.scheduledFor, tz)
                    : p.status === "published" && p.publishedAt
                      ? formatRelativeDay(p.publishedAt, tz)
                      : formatInZone(p.updatedAt, tz, { month: "short", day: "numeric" })
                }
              />
            ))}
          </div>
        ) : (
          <EmptyState title={`No ${filter.label.toLowerCase()} posts.`} description="Posts show up here as your stories move through review, scheduling and publishing." />
        )}
      </>
    );
  }

  const filter = STORY_FILTERS.find((f) => f.id === params.filter) ?? STORY_FILTERS[0];
  const supabase = await createClient();
  type StoryRow = { id: string; title: string; source_text: string; status: string; created_at: string; story_posts: { platform: string; status: string }[] };
  let stories: StoryRow[] = [];

  if (q) {
    const { data: found } = await supabase.rpc("search_stories", { q: escapeLike(q) });
    const ids = (found ?? []).map((s) => s.id);
    if (ids.length) {
      const { data } = await supabase.from("stories").select("id,title,source_text,status,created_at,story_posts(platform,status)").in("id", ids).order("updated_at", { ascending: false });
      stories = (data ?? []) as StoryRow[];
    }
  } else {
    let query = supabase.from("stories").select("id,title,source_text,status,created_at,story_posts(platform,status)").eq("user_id", user.id);
    query = filter.id === "archived" ? query.eq("status", "archived") : query.neq("status", "archived");
    if (filter.id === "drafts") query = query.eq("status", "draft");
    const { data } = await query.order("created_at", { ascending: false }).limit(150);
    stories = ((data ?? []) as StoryRow[]).filter((s) => {
      const statuses = s.story_posts.map((p) => p.status);
      if (filter.id === "review") return statuses.some((st) => st === "awaiting_review" || st === "draft");
      if (filter.id === "scheduled") return statuses.includes("scheduled");
      if (filter.id === "published") return statuses.includes("published");
      return true;
    });
  }

  return (
    <>
      <PageHeader
        title="Library"
        description="Every story and every post, in one place."
        actions={<ButtonLink href="/app/create">Create story</ButtonLink>}
      />
      {tabs}
      {!q ? (
        <nav aria-label="Story filter" className="scrollbar-none -mx-1 mb-6 flex gap-1 overflow-x-auto px-1">
          {STORY_FILTERS.map((f) => (
            <Link
              key={f.id}
              href={f.id === "all" ? "/app/library" : `/app/library?filter=${f.id}`}
              className={cn("shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors", f.id === filter.id ? "bg-ink text-white" : "text-muted hover:bg-wash hover:text-ink")}
            >
              {f.label}
            </Link>
          ))}
        </nav>
      ) : (
        <p className="mb-6 text-sm text-muted">
          {stories.length} {stories.length === 1 ? "result" : "results"} for “{q}” ·{" "}
          <Link href="/app/library" className="font-medium text-ink hover:underline">
            Clear
          </Link>
        </p>
      )}

      {stories.length ? (
        <ul className="stagger-in grid gap-3">
          {stories.map((s) => (
            <li key={s.id}>
              <Link
                href={`/app/library/${s.id}`}
                className="group grid grid-cols-1 gap-4 rounded-3xl bg-surface p-5 shadow-soft ring-1 ring-line transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              >
                <div className="min-w-0">
                  <div className="flex items-baseline gap-3">
                    <h2 className="truncate font-display text-[28px] leading-none tracking-[-0.015em]">{s.title}</h2>
                    <span className="shrink-0 text-xs text-faint">{formatInZone(s.created_at, tz, { month: "short", day: "numeric" })}</span>
                  </div>
                  <p className="mt-2 line-clamp-1 text-[14px] text-muted">{truncate(s.source_text, 180)}</p>
                </div>
                <div className="flex flex-wrap gap-1.5 sm:justify-end">
                  {s.story_posts.length ? (
                    s.story_posts.map((p, i) => {
                      const status = p.status as PostStatus;
                      return (
                        <span key={`${p.platform}-${i}`} className="flex h-7 items-center gap-1.5 rounded-full bg-wash pl-1 pr-2.5 text-[12px] font-medium text-ink-soft" title={STATUS_LABEL[status]}>
                          <PlatformIcon platform={p.platform as Platform} tile className="size-5 rounded-full" />
                          <span className={cn("size-1.5 rounded-full", DOT[STATUS_TONE[status]] ?? "bg-faint")} aria-hidden />
                          {STATUS_LABEL[status]}
                        </span>
                      );
                    })
                  ) : (
                    <span className="text-xs text-faint">{s.status === "processing" ? "Writing…" : "No posts yet"}</span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : q ? (
        <EmptyState title="Nothing matches that." description="Search looks through story titles, what you wrote, and every post." />
      ) : filter.id === "archived" ? (
        <EmptyState title="Nothing archived." description="Archived stories wait here. Restore one any time." />
      ) : filter.id === "all" ? (
        <EmptyState
          title="Nothing here yet."
          description="Tell Postory what happened in your business and we'll turn it into your next social story."
          action={<ButtonLink href="/app/create">Create a story</ButtonLink>}
        />
      ) : (
        <EmptyState title={`No ${filter.label.toLowerCase()} stories.`} description="Stories appear here as their posts move along." />
      )}
    </>
  );
}
