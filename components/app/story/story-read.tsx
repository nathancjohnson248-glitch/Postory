import Link from "next/link";
import { AlertTriangle, ArrowRight, Camera, ImageIcon, Layers, Video } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { PlatformIcon } from "@/components/brand/platform-icon";
import { isPlatform } from "@/lib/social/platforms";
import { cn } from "@/lib/utils";

export type StoryRead = {
  eventType?: string;
  significance?: string;
  strongestAngle?: string;
  strongestAngleWhy?: string;
  networkFit?: { platform: string; fit: "strong" | "good" | "weak"; why: string }[];
  media?: { kind: "none" | "real_screenshot" | "real_photo" | "generated_visual" | "video"; why: string } | null;
  repetition?: string | null;
  followUps?: string[];
  seriesIdea?: string | null;
};

const MEDIA: Record<NonNullable<StoryRead["media"]>["kind"], { label: string; icon: typeof Camera }> = {
  none: { label: "No media needed", icon: Layers },
  real_screenshot: { label: "Use a real screenshot", icon: ImageIcon },
  real_photo: { label: "Use a real photo", icon: Camera },
  generated_visual: { label: "A generated visual could work", icon: ImageIcon },
  video: { label: "Video would land best", icon: Video },
};

const FIT_STYLE = { strong: "text-success", good: "text-ink-soft", weak: "text-faint" } as const;

/** Postory's read of the story: what it is, why it matters, the best angle, where it fits, and what could follow. */
export function StoryReadCard({ read }: { read: StoryRead }) {
  if (!read.strongestAngle && !read.significance) return null;
  const media = read.media ? MEDIA[read.media.kind] : null;
  const createLink = (text: string) => `/app/create?text=${encodeURIComponent(text)}`;
  return (
    <div className="rounded-3xl bg-surface p-5 shadow-soft ring-1 ring-line">
      <div className="flex items-center gap-2">
        <LogoMark className="size-5" blink={false} />
        <p className="text-[13px] font-semibold">Postory&apos;s read</p>
        {read.eventType ? <span className="ml-auto rounded-full bg-wash px-2 py-0.5 text-[11.5px] font-medium capitalize text-ink-soft">{read.eventType}</span> : null}
      </div>
      {read.significance ? <p className="mt-3 text-[13.5px] leading-relaxed text-ink-soft">{read.significance}</p> : null}

      {read.repetition ? (
        <p className="mt-3 flex gap-2 rounded-2xl bg-warning-wash px-3 py-2 text-[13px] leading-relaxed text-warning">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {read.repetition}
        </p>
      ) : null}

      {read.strongestAngle ? (
        <div className="mt-4 rounded-2xl bg-blue-50 px-3.5 py-3">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-blue-700">Strongest angle</p>
          <p className="mt-1 text-[14px] font-semibold text-blue-950">{read.strongestAngle}</p>
          {read.strongestAngleWhy ? <p className="mt-0.5 text-[13px] leading-relaxed text-blue-900/80">{read.strongestAngleWhy}</p> : null}
        </div>
      ) : null}

      {read.networkFit?.length ? (
        <ul className="mt-4 flex flex-col gap-2">
          {read.networkFit.filter((n) => isPlatform(n.platform)).map((n) => (
            <li key={n.platform} className="flex items-start gap-2.5 text-[13px]">
              {isPlatform(n.platform) ? <PlatformIcon platform={n.platform} tile className="mt-0.5 size-5 shrink-0 rounded-md" /> : null}
              <span className="min-w-0">
                <span className={cn("font-semibold capitalize", FIT_STYLE[n.fit])}>{n.fit} fit</span>
                <span className="text-muted"> · {n.why}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {media && read.media ? (
        <p className="mt-4 flex items-start gap-2.5 text-[13px]">
          <media.icon className="mt-0.5 size-4 shrink-0 text-blue-600" aria-hidden />
          <span>
            <span className="font-semibold">{media.label}.</span> <span className="text-muted">{read.media.why}</span>
          </span>
        </p>
      ) : null}

      {read.followUps?.length || read.seriesIdea ? (
        <div className="mt-4 border-t border-line pt-4">
          <p className="text-[12.5px] font-semibold text-ink-soft">What could come next</p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {read.seriesIdea ? (
              <li>
                <Link href={createLink(`Series idea: ${read.seriesIdea}`)} className="group flex items-start gap-2 text-[13px] text-ink-soft hover:text-ink">
                  <Layers className="mt-0.5 size-3.5 shrink-0 text-blue-600" aria-hidden />
                  <span className="flex-1">{read.seriesIdea}</span>
                  <ArrowRight className="mt-0.5 size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                </Link>
              </li>
            ) : null}
            {read.followUps?.map((f) => (
              <li key={f}>
                <Link href={createLink(f)} className="group flex items-start gap-2 text-[13px] text-ink-soft hover:text-ink">
                  <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-blue-600" aria-hidden />
                  <span className="flex-1">{f}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
