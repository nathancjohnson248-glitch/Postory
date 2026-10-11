"use client";

import { motion, useReducedMotion } from "motion/react";
import { PlatformIcon } from "@/components/brand/platform-icon";
import { PostStatusBadge } from "@/components/product/status-badge";
import { DEMO_LABEL, demoBusiness, demoPosts, demoStory } from "@/lib/demo/data";
import { PLATFORM_META } from "@/lib/social/platforms";
import { cn } from "@/lib/utils";

/** Marketing visual: one story becoming platform-native posts. Uses demo data. */
export function StoryFanout({ className, compact = false }: { className?: string; compact?: boolean }) {
  const reduce = useReducedMotion();
  const posts = compact ? demoPosts.slice(0, 3) : demoPosts;

  return (
    <div className={cn("relative", className)}>
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 140, damping: 20 }}
        className="relative z-10 rounded-3xl bg-surface p-5 shadow-lift ring-1 ring-line"
      >
        <div className="flex items-center justify-between">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Story · {demoStory.title}</p>
          <span className="rounded-full bg-wash px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted">{DEMO_LABEL}</span>
        </div>
        <p className="mt-3 font-display text-[26px] leading-[1.15] tracking-[-0.01em] text-ink">“{demoStory.source}”</p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {demoStory.angles.map((a) => (
            <span key={a} className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
              {a}
            </span>
          ))}
        </div>
      </motion.div>

      <svg className="mx-auto -my-1 h-10 w-full text-blue-300" viewBox="0 0 400 40" preserveAspectRatio="none" aria-hidden>
        {[60, 160, 240, 340].slice(0, posts.length).map((x, i) => (
          <motion.path
            key={x}
            d={`M200 0 C200 22 ${x} 18 ${x} 40`}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeDasharray="3 4"
            initial={reduce ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 0.25 + i * 0.08, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          />
        ))}
      </svg>

      <div className={cn("grid gap-3", compact ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2")}>
        {posts.map((post, i) => (
          <motion.div
            key={post.platform}
            initial={reduce ? false : { opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.35 + i * 0.09, type: "spring", stiffness: 160, damping: 22 }}
            className="rounded-2xl bg-surface p-4 shadow-soft ring-1 ring-line"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-[13px] font-semibold">
                <PlatformIcon platform={post.platform} tile className="size-6 rounded-[7px]" />
                {PLATFORM_META[post.platform].name}
              </span>
              <PostStatusBadge status={post.status} />
            </div>
            <p className="line-clamp-4 whitespace-pre-line text-[13.5px] leading-[1.5] text-ink-soft">{post.content}</p>
            <p className="mt-3 text-[11px] text-faint">
              {demoBusiness.name} · {post.when}
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
