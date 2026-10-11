"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, CheckCheck, Sparkles } from "lucide-react";
import { PlatformIcon } from "@/components/brand/platform-icon";
import { LogoMark } from "@/components/brand/logo";
import { ColumnChart } from "@/components/app/analytics/column-chart";
import { PostPreview } from "@/components/product/post-preview";
import { PostStatusBadge } from "@/components/product/status-badge";
import { DEMO_LABEL, demoAnalytics, demoBusiness, demoCalendar, demoPosts, demoStory } from "@/lib/demo/data";
import type { PostStatus } from "@/lib/posts/state-machine";
import { PLATFORM_META } from "@/lib/social/platforms";
import { cn } from "@/lib/utils";

function DemoTag({ className }: { className?: string }) {
  return (
    <span className={cn("rounded-full bg-wash px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted ring-1 ring-line", className)}>
      {DEMO_LABEL}
    </span>
  );
}

/** Hero centerpiece: the Create → Review surface, built from real Postory components. */
export function HeroProduct() {
  const reduce = useReducedMotion();
  const posts = demoPosts.slice(0, 3);
  return (
    <div className="relative">
      <div className="absolute -inset-x-10 -bottom-10 -top-6 -z-10 rounded-[48px] bg-gradient-to-b from-blue-50/70 to-transparent" aria-hidden />
      <div className="overflow-hidden rounded-[28px] bg-surface shadow-float ring-1 ring-line">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <div className="flex items-center gap-2">
            <LogoMark variant="tile" className="size-6" />
            <span className="text-[13px] font-semibold">Story · {demoStory.title}</span>
          </div>
          <DemoTag />
        </div>
        <div className="grid lg:grid-cols-[0.95fr_1.6fr]">
          <div className="border-b border-line p-6 lg:border-b-0 lg:border-r">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted">What happened?</p>
            <p className="mt-3 font-display text-[28px] leading-[1.2] tracking-[-0.01em]">{demoStory.source}</p>
            <ul className="mt-6 flex flex-col gap-2.5">
              {["Understanding your story", "Finding angles and writing platform versions", "Checking facts and limits", "Preparing your review"].map((s, i) => (
                <motion.li
                  key={s}
                  initial={reduce ? false : { opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.25 }}
                  className="flex items-center gap-2.5 text-[13px] text-muted"
                >
                  <span className="grid size-5 place-items-center rounded-full bg-blue-500 text-white">
                    <Check className="size-3" aria-hidden />
                  </span>
                  {s}
                </motion.li>
              ))}
            </ul>
            <div className="mt-6 flex flex-wrap gap-1.5">
              {demoStory.angles.map((a) => (
                <span key={a} className="rounded-full bg-blue-50 px-2.5 py-1 text-[12px] font-medium text-blue-700">
                  {a}
                </span>
              ))}
            </div>
          </div>
          <div className="grid gap-3 bg-paper/60 p-4 sm:grid-cols-2 lg:p-5">
            {posts.map((post, i) => (
              <motion.div
                key={post.platform}
                initial={reduce ? false : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.2 + i * 0.12, type: "spring", stiffness: 160, damping: 22 }}
                className={cn("rounded-2xl bg-surface p-4 shadow-soft ring-1 ring-line", i === 2 && "sm:col-span-2")}
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="flex items-center gap-2 text-[13px] font-semibold">
                    <PlatformIcon platform={post.platform} tile className="size-6 rounded-[7px]" />
                    {PLATFORM_META[post.platform].name}
                  </span>
                  <PostStatusBadge status={post.status} />
                </div>
                <PostPreview platform={post.platform} content={post.content} authorName={demoBusiness.name} handle={demoBusiness.handle} clamp={i === 1 ? 5 : 4} />
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Side-by-side platform versions — same facts, native voice. */
export function PlatformVersions() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {demoPosts.map((post) => (
        <div key={post.platform} className="flex flex-col rounded-3xl bg-surface p-5 shadow-soft ring-1 ring-line">
          <div className="mb-4 flex items-center justify-between">
            <span className="flex items-center gap-2 text-[14px] font-semibold">
              <PlatformIcon platform={post.platform} tile className="size-7 rounded-lg" />
              {PLATFORM_META[post.platform].name}
            </span>
            <DemoTag />
          </div>
          <PostPreview platform={post.platform} content={post.content} authorName={demoBusiness.name} handle={demoBusiness.handle} />
        </div>
      ))}
    </div>
  );
}

/** A working mini approval queue (local state only, labelled as an example). */
export function ApprovalDemo() {
  const [statuses, setStatuses] = useState<Record<string, PostStatus>>(() => Object.fromEntries(demoPosts.map((p) => [p.platform, p.status === "approved" ? "approved" : p.status === "published" ? "awaiting_review" : p.status])));
  const pending = Object.values(statuses).filter((s) => s === "awaiting_review").length;
  return (
    <div className="rounded-3xl bg-surface shadow-lift ring-1 ring-line">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <p className="text-[15px] font-semibold">{pending ? `${pending} posts need review` : "Everything's approved"}</p>
          <p className="text-[12.5px] text-muted">{demoStory.title}</p>
        </div>
        <div className="flex items-center gap-2">
          <DemoTag />
          <button
            type="button"
            onClick={() => setStatuses((s) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v === "awaiting_review" ? "approved" : v])) as Record<string, PostStatus>)}
            disabled={!pending}
            className="flex h-9 items-center gap-1.5 rounded-xl bg-blue-500 px-3.5 text-[13px] font-medium text-white transition-all hover:bg-blue-600 disabled:opacity-40"
          >
            <CheckCheck className="size-4" aria-hidden /> Approve all
          </button>
        </div>
      </div>
      <ul className="divide-y divide-line">
        {demoPosts.map((post) => (
          <li key={post.platform} className="flex items-center gap-3.5 px-5 py-3.5">
            <PlatformIcon platform={post.platform} tile className="size-8 rounded-[10px]" />
            <p className="min-w-0 flex-1 truncate text-[13.5px] text-ink-soft">{post.content.replace(/\s+/g, " ")}</p>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={statuses[post.platform]} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                <PostStatusBadge status={statuses[post.platform]} />
              </motion.span>
            </AnimatePresence>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A month at a glance, with example posts. */
export function CalendarDemo() {
  const days = Array.from({ length: 35 }, (_, i) => i - 2);
  return (
    <div className="overflow-hidden rounded-3xl bg-surface shadow-lift ring-1 ring-line">
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <p className="text-[15px] font-semibold">October</p>
        <DemoTag />
      </div>
      <div className="grid grid-cols-7 border-b border-line text-center font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const items = demoCalendar.filter((c) => c.day === day);
          return (
            <div key={i} className={cn("min-h-20 border-line p-1.5 sm:min-h-24", i % 7 !== 6 && "border-r", i < 28 && "border-b", day < 1 || day > 31 ? "bg-paper/70" : "")}>
              <p className={cn("mb-1 text-right text-[11px] tabular-nums", day === 12 ? "font-semibold text-blue-600" : "text-faint")}>{day >= 1 && day <= 31 ? day : ""}</p>
              {items.map((item) => (
                <div key={item.title} className="mb-1 flex items-center gap-1 rounded-md bg-wash px-1 py-0.5 text-[10.5px] ring-1 ring-line" title={item.title}>
                  <PlatformIcon platform={item.platform} className="size-2.5 shrink-0" />
                  <span className="truncate text-ink-soft">{item.time}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AnalyticsDemo() {
  const weeks = ["Aug 4", "Aug 11", "Aug 18", "Aug 25", "Sep 1", "Sep 8", "Sep 15", "Sep 22", "Sep 29", "Oct 6", "Oct 13", "Oct 20"];
  return (
    <div className="rounded-3xl bg-surface p-6 shadow-lift ring-1 ring-line">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[22px] font-semibold leading-tight tracking-[-0.02em]">{demoAnalytics.headline}</p>
          <ul className="mt-3 flex flex-col gap-1">
            {demoAnalytics.bullets.map((b) => (
              <li key={b} className="text-[14px] text-muted">
                {b}
              </li>
            ))}
          </ul>
        </div>
        <DemoTag />
      </div>
      <div className="mt-6">
        <ColumnChart data={demoAnalytics.series.map((v, i) => ({ label: weeks[i], value: v }))} label="Engagements per week (example)" unit="engagements" height={150} />
      </div>
    </div>
  );
}

export function MemoryDemo() {
  return (
    <div className="grid gap-4">
      <div className="rounded-3xl bg-surface p-6 shadow-soft ring-1 ring-line">
        <div className="flex items-center justify-between">
          <p className="text-[15px] font-semibold">Business memory</p>
          <DemoTag />
        </div>
        <ul className="mt-4 flex flex-col divide-y divide-line">
          {[
            ["Product", "Fernwood is a calm habit tracker for iPhone."],
            ["Audience", "People who want fewer, better habits."],
            ["Voice", "Casual, minimal. Lowercase on X is fine."],
            ["Milestone", "Launched on iOS — 37 downloads in the first hour."],
          ].map(([k, v]) => (
            <li key={k} className="flex gap-4 py-2.5 text-[13.5px]">
              <span className="w-20 shrink-0 font-mono text-[10.5px] uppercase tracking-[0.12em] text-faint">{k}</span>
              <span className="text-ink-soft">{v}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-3xl bg-surface p-5 ring-1 ring-line">
          <p className="flex items-center gap-1.5 text-[12px] font-medium text-success">
            <Check className="size-3.5" aria-hidden /> Postory writes
          </p>
          <p className="mt-2 text-[15px] font-medium">“37 downloads in the first hour.”</p>
        </div>
        <div className="rounded-3xl bg-surface p-5 ring-1 ring-line">
          <p className="flex items-center gap-1.5 text-[12px] font-medium text-danger">
            <Sparkles className="size-3.5" aria-hidden /> Postory won&apos;t write
          </p>
          <p className="mt-2 text-[15px] font-medium text-muted line-through decoration-danger/60">“37 happy customers already love it.”</p>
        </div>
      </div>
    </div>
  );
}
