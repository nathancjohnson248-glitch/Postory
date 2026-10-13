import { BarChart3, Brain, CalendarDays, ImageIcon, MessageSquareReply, Sparkle } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { PlatformIcon } from "@/components/brand/platform-icon";
import { cn } from "@/lib/utils";

/**
 * Everything around a story, in one bento: each tile is the AI doing one more
 * job. Small static mockups, labelled as examples by the section around them.
 */
export function Capabilities() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
      <Tile className="md:col-span-4" icon={Sparkle} title="Plan" body="Postory looks at your recent stories, memory and schedule, and suggests what's worth posting next. When it needs a real detail, it asks.">
        <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[
            ["Tue", "Two weeks since the iOS launch", "What's changed since? Add a real number."],
            ["Thu", "Behind the build: offline sync", "From your memory: “works without signal”"],
            ["Fri", "LinkedIn has gone quiet", "Last post 12 days ago"],
          ].map(([day, title, note]) => (
            <div key={title} className="rounded-2xl bg-wash p-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">{day}</p>
              <p className="mt-1 text-[13.5px] font-semibold leading-snug">{title}</p>
              <p className="mt-1 text-[12px] leading-snug text-muted">{note}</p>
            </div>
          ))}
        </div>
      </Tile>

      <Tile className="md:col-span-2" icon={Brain} title="Business memory" body="What you do, how you sound, what's true. Every post uses it, and nothing outside it is claimed as fact.">
        <ul className="mt-5 flex flex-col gap-1.5 text-[12.5px]">
          {[
            ["Product", "Offline-first notes app"],
            ["Voice", "Plain, a little dry"],
            ["Never say", "“revolutionary”"],
          ].map(([k, v]) => (
            <li key={k} className="flex justify-between gap-3 rounded-xl bg-wash px-3 py-2">
              <span className="text-muted">{k}</span>
              <span className="truncate font-medium">{v}</span>
            </li>
          ))}
        </ul>
      </Tile>

      <Tile className="md:col-span-2" icon={MessageSquareReply} title="Inbox" body="Comments on your posts from Instagram, Threads, Facebook and Bluesky. Postory drafts a reply; you send it.">
        <div className="mt-5 rounded-2xl bg-wash p-3 text-[12.5px]">
          <p className="flex items-center gap-1.5 font-medium">
            <PlatformIcon platform="instagram" tile className="size-4 rounded" /> @ana.builds
          </p>
          <p className="mt-1 text-ink-soft">does it sync with the web app?</p>
          <div className="mt-2 flex gap-2 rounded-xl bg-surface p-2 shadow-hairline">
            <LogoMark className="size-4" blink={false} />
            <p className="text-ink-soft">Yes, notes sync both ways once you&apos;re back online.</p>
          </div>
        </div>
      </Tile>

      <Tile className="md:col-span-2" icon={ImageIcon} title="Images" body="A visual for any post, sized for where it's going. No fake people, screenshots or results. Or upload your own.">
        <div className="mt-5 flex items-end gap-2">
          <div className="aspect-[4/5] w-1/3 rounded-xl bg-[radial-gradient(circle_at_30%_20%,#bfd0ff,#2f5bff_70%)]" />
          <div className="aspect-square w-1/3 rounded-xl bg-[radial-gradient(circle_at_70%_30%,#fde7c8,#e98a3a_75%)]" />
          <div className="aspect-[16/10] w-1/3 rounded-xl bg-[radial-gradient(circle_at_40%_60%,#d6f5e8,#11795a_80%)]" />
        </div>
      </Tile>

      <Tile className="md:col-span-2" icon={CalendarDays} title="Calendar" body="Everything scheduled, in your timezone. Drag to move. Postory sends it at the time, and tells you if a network refuses.">
        <div className="mt-5 grid grid-cols-7 gap-1">
          {Array.from({ length: 14 }, (_, i) => (
            <div key={i} className={cn("aspect-square rounded-md", [2, 4, 9, 11].includes(i) ? "bg-blue-500" : [6, 13].includes(i) ? "bg-blue-200" : "bg-wash")} />
          ))}
        </div>
      </Tile>

      <Tile className="md:col-span-6" icon={BarChart3} title="Analytics" body="Likes, comments and reposts read back from each network that shares them, tied to the story behind them. Nothing estimated, nothing made up.">
        <div className="mt-5 flex h-20 items-end gap-1.5">
          {[3, 5, 4, 7, 6, 9, 8, 12, 10, 14, 11, 15].map((h, i) => (
            <div key={i} className={cn("flex-1 rounded-t-md", i === 11 ? "bg-blue-500" : "bg-blue-100")} style={{ height: `${(h / 15) * 100}%` }} />
          ))}
        </div>
      </Tile>
    </div>
  );
}

function Tile({ icon: Icon, title, body, className, children }: { icon: typeof Sparkle; title: string; body: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("flex flex-col rounded-[26px] bg-surface p-6 shadow-soft ring-1 ring-line", className)}>
      <p className="flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em]">
        <span className="grid size-8 place-items-center rounded-xl bg-blue-50 text-blue-600">
          <Icon className="size-4" aria-hidden />
        </span>
        {title}
      </p>
      <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-muted">{body}</p>
      <div className="mt-auto">{children}</div>
    </div>
  );
}
