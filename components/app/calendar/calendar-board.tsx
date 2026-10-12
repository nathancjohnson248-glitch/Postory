"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { CalendarClock, ChevronLeft, ChevronRight, ExternalLink, GripVertical } from "lucide-react";
import { PlatformIcon } from "@/components/brand/platform-icon";
import { PostPreview } from "@/components/product/post-preview";
import { PostStatusBadge } from "@/components/product/status-badge";
import { ScheduleDialog } from "@/components/app/story/schedule-dialog";
import { Button, ButtonLink } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { reschedulePostAction, schedulePostAction, unschedulePostAction } from "@/app/_actions/posts";
import type { PostView } from "@/lib/data/posts";
import { PLATFORM_META } from "@/lib/social/platforms";
import { dateKey, formatInZone, formatTime, monthGrid, shiftMonth, timeKey, toZonedIso, zonedToUtc } from "@/lib/time";
import { cn, truncate } from "@/lib/utils";

const STATUS_STYLE: Record<string, string> = {
  scheduled: "bg-surface ring-line",
  published: "bg-success-wash/70 ring-[#cfeadf]",
  failed: "bg-danger-wash ring-[#f6cfcd]",
  publishing: "bg-blue-50 ring-blue-100",
};

/** Scheduling needs a couple of minutes' lead time (checked again on the server). */
function tooSoon(instant: Date) {
  return instant.getTime() < Date.now() + 2 * 60 * 1000;
}

function postInstant(p: PostView) {
  return p.status === "published" ? p.publishedAt : p.scheduledFor;
}

export function CalendarBoard({
  month,
  view,
  posts: initialPosts,
  tray,
  timezone,
  businessName,
  today,
}: {
  month: string;
  view: "month" | "agenda";
  posts: PostView[];
  tray: PostView[];
  timezone: string;
  businessName: string;
  today: string;
}) {
  const router = useRouter();
  const [posts, setPosts] = useState(initialPosts);
  const [open, setOpen] = useState<PostView | null>(null);
  const [rescheduling, setRescheduling] = useState<PostView | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const days = useMemo(() => monthGrid(month), [month]);
  const byDay = useMemo(() => {
    const map = new Map<string, PostView[]>();
    for (const p of posts) {
      const at = postInstant(p);
      if (!at) continue;
      const key = dateKey(new Date(at), timezone);
      map.set(key, [...(map.get(key) ?? []), p]);
    }
    for (const list of map.values()) list.sort((a, b) => (postInstant(a) ?? "").localeCompare(postInstant(b) ?? ""));
    return map;
  }, [posts, timezone]);

  const monthLabel = formatInZone(new Date(`${month}-15T12:00:00Z`), "UTC", { month: "long", year: "numeric" });

  async function moveTo(postId: string, day: string) {
    const fromTray = tray.find((t) => t.id === postId);
    const existing = posts.find((p) => p.id === postId);
    const source = existing ?? fromTray;
    if (!source) return;
    if (source.status !== "scheduled" && source.status !== "approved") return;
    if (source.media.length && !existing) {
      toast.error("Posts with media can't be scheduled through the publishing provider yet. Publish it now from its story.");
      return;
    }
    const time = source.scheduledFor ? timeKey(new Date(source.scheduledFor), timezone) : "09:00";
    const instant = zonedToUtc(day, time, timezone);
    if (tooSoon(instant)) {
      toast.error("That time has already passed. Pick a later day.");
      return;
    }
    const iso = toZonedIso(instant, timezone);
    const previous = posts;
    // Optimistic move; reverted if the provider refuses.
    setPosts((cur) => {
      const moved = { ...source, status: "scheduled" as const, scheduledFor: instant.toISOString() };
      return existing ? cur.map((p) => (p.id === postId ? moved : p)) : [...cur, moved];
    });
    const action = existing ? reschedulePostAction : schedulePostAction;
    const result = await action({ postId, scheduledFor: iso });
    if (!result.ok) {
      setPosts(previous);
      toast.error(result.error.message);
      return;
    }
    toast.success(`${existing ? "Moved" : "Scheduled"} to ${formatInZone(instant, timezone, { weekday: "short", month: "short", day: "numeric" })}, ${formatTime(instant, timezone)}.`);
    startTransition(() => router.refresh());
  }

  const header = (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Link href={`/app/calendar?view=${view}&month=${shiftMonth(month, -1)}`} className="grid size-9 place-items-center rounded-xl text-muted ring-1 ring-line transition-colors hover:bg-wash hover:text-ink" aria-label="Previous month">
          <ChevronLeft className="size-4" />
        </Link>
        <h2 className="min-w-44 text-center text-lg font-semibold tracking-[-0.015em]">{monthLabel}</h2>
        <Link href={`/app/calendar?view=${view}&month=${shiftMonth(month, 1)}`} className="grid size-9 place-items-center rounded-xl text-muted ring-1 ring-line transition-colors hover:bg-wash hover:text-ink" aria-label="Next month">
          <ChevronRight className="size-4" />
        </Link>
        <Link href={`/app/calendar?view=${view}`} className="ml-1 rounded-xl px-3 py-2 text-[13px] font-medium text-muted hover:bg-wash hover:text-ink">
          Today
        </Link>
      </div>
      <div className="inline-flex rounded-xl bg-wash p-0.5 text-[13px] font-medium">
        {(["month", "agenda"] as const).map((v) => (
          <Link
            key={v}
            href={`/app/calendar?view=${v}&month=${month}`}
            className={cn("rounded-[10px] px-3.5 py-1.5 capitalize transition-all", view === v ? "bg-surface text-ink shadow-hairline" : "text-muted hover:text-ink")}
            aria-current={view === v ? "page" : undefined}
          >
            {v}
          </Link>
        ))}
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0">
        {header}
        {view === "month" ? (
          <div className="overflow-hidden rounded-3xl bg-surface shadow-soft ring-1 ring-line">
            <div className="grid grid-cols-7 border-b border-line text-center font-mono text-[10.5px] uppercase tracking-[0.12em] text-faint">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                <div key={d} className="py-2.5">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {days.map((d, i) => {
                const items = byDay.get(d.key) ?? [];
                const isToday = d.key === today;
                const past = d.key < today;
                return (
                  <div
                    key={d.key}
                    onDragOver={(e) => {
                      if (past) return;
                      e.preventDefault();
                      setDragOver(d.key);
                    }}
                    onDragLeave={() => setDragOver((k) => (k === d.key ? null : k))}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOver(null);
                      const id = e.dataTransfer.getData("text/postory-post");
                      if (id && !past) moveTo(id, d.key);
                    }}
                    className={cn(
                      "min-h-[4.5rem] border-line p-1 transition-colors sm:min-h-32 sm:p-1.5",
                      i % 7 !== 6 && "border-r",
                      i < 35 && "border-b",
                      !d.inMonth && "bg-paper/70",
                      dragOver === d.key && "bg-blue-50",
                    )}
                    aria-label={formatInZone(new Date(`${d.key}T12:00:00Z`), "UTC", { weekday: "long", month: "long", day: "numeric" })}
                  >
                    <div className="mb-1 flex justify-end px-1">
                      <span
                        className={cn(
                          "grid size-6 place-items-center rounded-full text-[12px] tabular-nums",
                          isToday ? "bg-blue-500 font-semibold text-white" : d.inMonth ? "text-ink-soft" : "text-faint",
                        )}
                      >
                        {d.day}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      {items.slice(0, 3).map((p) => (
                        <motion.div layoutId={p.id} key={p.id} transition={{ type: "spring", stiffness: 420, damping: 34 }}>
                          <button
                            type="button"
                            draggable={p.status === "scheduled"}
                            onDragStart={(e) => e.dataTransfer.setData("text/postory-post", p.id)}
                            onClick={() => setOpen(p)}
                            className={cn(
                              "flex w-full items-center gap-1.5 rounded-lg px-1.5 py-1 text-left text-[11.5px] ring-1 transition-shadow hover:shadow-soft",
                              STATUS_STYLE[p.status] ?? "bg-surface ring-line",
                              p.status === "scheduled" && "cursor-grab active:cursor-grabbing",
                            )}
                            title={`${PLATFORM_META[p.platform].name} · ${p.content}`}
                          >
                            <PlatformIcon platform={p.platform} className="size-3 shrink-0" />
                            <span className="shrink-0 font-medium tabular-nums text-ink-soft">{formatTime(postInstant(p)!, timezone).replace(":00", "")}</span>
                            <span className="hidden min-w-0 truncate text-muted sm:inline">{truncate(p.content.replace(/\s+/g, " "), 40)}</span>
                          </button>
                        </motion.div>
                      ))}
                      {items.length > 3 ? (
                        <button type="button" onClick={() => setOpen(items[3])} className="px-1.5 text-left text-[11px] font-medium text-muted hover:text-ink">
                          +{items.length - 3} more
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <Agenda byDay={byDay} timezone={timezone} onOpen={setOpen} />
        )}
        <p className="mt-3 text-xs text-faint">Times shown in {timezone.replace(/_/g, " ")}. Drag a scheduled post to another day to move it.</p>
      </div>

      <aside className="flex flex-col gap-3">
        <div className="rounded-3xl bg-surface p-4 shadow-soft ring-1 ring-line">
          <p className="text-[14px] font-semibold">Ready to schedule</p>
          <p className="mt-0.5 text-[12.5px] text-muted">Approved posts. Drag one onto a day (9:00 AM), or open it to pick a time.</p>
          {tray.length ? (
            <ul className="mt-3 flex flex-col gap-1.5">
              {tray.map((p) => (
                <li
                  key={p.id}
                  draggable={!p.media.length}
                  onDragStart={(e) => e.dataTransfer.setData("text/postory-post", p.id)}
                  className={cn("flex items-start gap-2 rounded-xl bg-paper px-2.5 py-2 ring-1 ring-line", !p.media.length && "cursor-grab active:cursor-grabbing")}
                >
                  <GripVertical className="mt-0.5 size-3.5 shrink-0 text-faint" aria-hidden />
                  <PlatformIcon platform={p.platform} className="mt-0.5 size-3.5 shrink-0" />
                  <button type="button" onClick={() => setRescheduling(p)} className="min-w-0 text-left">
                    <span className="block truncate text-[12.5px] font-medium">{p.storyTitle}</span>
                    <span className="line-clamp-2 text-[12px] text-muted">{p.content}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 rounded-xl bg-wash px-3 py-3 text-[12.5px] text-muted">Nothing approved and waiting. Approve posts from a story to plan them here.</p>
          )}
        </div>
      </aside>

      <Dialog open={open !== null} onClose={() => setOpen(null)} title={open ? `${PLATFORM_META[open.platform].name} · ${open.storyTitle}` : ""} className="max-w-xl">
        {open ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <PostStatusBadge status={open.status} />
              <span className="text-[13px] text-muted">
                {postInstant(open) ? `${formatInZone(postInstant(open)!, timezone, { weekday: "long", month: "short", day: "numeric" })}, ${formatTime(postInstant(open)!, timezone)}` : ""}
              </span>
            </div>
            <div className="rounded-2xl bg-paper p-4 ring-1 ring-line">
              <PostPreview platform={open.platform} content={open.content} authorName={businessName} handle={open.account?.name} media={open.media.map((m) => ({ kind: m.kind, url: m.url }))} clamp={10} />
            </div>
            {open.status === "failed" && open.errorMessage ? <p className="text-[13px] text-danger">{open.errorMessage}</p> : null}
            <div className="flex flex-wrap justify-end gap-2">
              <ButtonLink href={`/app/library/${open.storyId}#post-${open.id}`} variant="ghost" size="sm">
                Open story
              </ButtonLink>
              {open.externalUrl ? (
                <ButtonLink href={open.externalUrl} target="_blank" rel="noreferrer noopener" variant="ghost" size="sm" icon={<ExternalLink className="size-3.5" />}>
                  View post
                </ButtonLink>
              ) : null}
              {open.status === "scheduled" ? (
                <>
                  <ConfirmButton
                    size="sm"
                    variant="ghost"
                    confirmVariant="primary"
                    title="Unschedule this post?"
                    description="It goes back to Approved."
                    confirmLabel="Unschedule"
                    onConfirm={async () => {
                      const result = await unschedulePostAction(open.id);
                      if (!result.ok) {
                        toast.error(result.error.message);
                        return;
                      }
                      setPosts((cur) => cur.filter((p) => p.id !== open.id));
                      setOpen(null);
                      toast.success("Unscheduled.");
                      startTransition(() => router.refresh());
                    }}
                  >
                    Unschedule
                  </ConfirmButton>
                  <Button
                    size="sm"
                    icon={<CalendarClock className="size-3.5" />}
                    onClick={() => {
                      setRescheduling(open);
                      setOpen(null);
                    }}
                  >
                    Reschedule
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        ) : null}
      </Dialog>

      {rescheduling ? (
        <ScheduleDialog
          open
          onClose={() => setRescheduling(null)}
          timezone={timezone}
          title={rescheduling.status === "scheduled" ? "Reschedule post" : "Schedule post"}
          confirmLabel={rescheduling.status === "scheduled" ? "Reschedule" : "Schedule"}
          initial={rescheduling.scheduledFor}
          onSubmit={async (iso) => {
            const action = rescheduling.status === "scheduled" ? reschedulePostAction : schedulePostAction;
            const result = await action({ postId: rescheduling.id, scheduledFor: iso });
            if (!result.ok) return result.error.message;
            toast.success(rescheduling.status === "scheduled" ? "Rescheduled." : "Scheduled.");
            startTransition(() => router.refresh());
            return null;
          }}
        />
      ) : null}
    </div>
  );
}

function Agenda({ byDay, timezone, onOpen }: { byDay: Map<string, PostView[]>; timezone: string; onOpen: (p: PostView) => void }) {
  const keys = [...byDay.keys()].sort();
  if (!keys.length) {
    return <EmptyState title="Your calendar is clear." description="Approve a post and schedule it, and it will appear here." />;
  }
  return (
    <div className="flex flex-col gap-6">
      {keys.map((key) => (
        <section key={key}>
          <h3 className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
            {formatInZone(new Date(`${key}T12:00:00Z`), "UTC", { weekday: "long", month: "long", day: "numeric" })}
          </h3>
          <ul className="stagger-in rounded-3xl bg-surface p-2 shadow-soft ring-1 ring-line">
            {byDay.get(key)!.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => onOpen(p)} className="flex w-full items-center gap-3.5 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-wash">
                  <span className="w-16 shrink-0 text-[13px] font-medium tabular-nums text-ink-soft">{formatTime(postInstant(p)!, timezone)}</span>
                  <PlatformIcon platform={p.platform} tile className="size-8 rounded-[10px]" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold">{p.storyTitle}</span>
                    <span className="block truncate text-[13px] text-muted">{p.content.replace(/\s+/g, " ")}</span>
                  </span>
                  <PostStatusBadge status={p.status} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
