import type { ReactNode } from "react";
import { ImageIcon, Play } from "lucide-react";
import { PlatformIcon } from "@/components/brand/platform-icon";
import { PLATFORM_META, countCharacters, type Platform } from "@/lib/social/platforms";
import { cn } from "@/lib/utils";

export type PreviewMedia = { kind: "image" | "video"; url?: string | null; alt?: string };

/**
 * Platform-shaped preview of a post. It mirrors each network's layout
 * (media-first for Instagram, tall pins for Pinterest, compact for X) using
 * Postory's own visual language — it deliberately doesn't imitate the apps.
 */
export function PostPreview({
  platform,
  content,
  authorName,
  handle,
  media = [],
  meta,
  className,
  clamp,
}: {
  platform: Platform;
  content: string;
  authorName: string;
  handle?: string | null;
  media?: PreviewMedia[];
  meta?: ReactNode;
  className?: string;
  clamp?: number;
}) {
  const mediaFirst = platform === "instagram" || platform === "pinterest" || platform === "tiktok";
  const initial = authorName.trim().charAt(0).toUpperCase() || "P";

  const header = (
    <div className="flex items-center gap-2.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ink text-[13px] font-semibold text-white">{initial}</span>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-[13px] font-semibold text-ink">{authorName}</p>
        {handle ? <p className="truncate text-xs text-muted">{handle}</p> : null}
      </div>
      <PlatformIcon platform={platform} className="size-3.5 text-ink-soft" />
    </div>
  );

  const body = (
    <p
      className={cn(
        "whitespace-pre-line break-words text-ink",
        platform === "x" || platform === "bluesky" || platform === "threads" ? "text-[14.5px] leading-[1.45]" : "text-[14px] leading-[1.55]",
      )}
      style={clamp ? { display: "-webkit-box", WebkitLineClamp: clamp, WebkitBoxOrient: "vertical", overflow: "hidden" } : undefined}
    >
      {content || <span className="text-faint">No text yet.</span>}
    </p>
  );

  const mediaBlock = <MediaFrame platform={platform} media={media} />;

  return (
    <article className={cn("flex flex-col gap-3", className)} aria-label={`${PLATFORM_META[platform].name} post preview`}>
      {header}
      {mediaFirst ? (
        <>
          {mediaBlock}
          {body}
        </>
      ) : (
        <>
          {body}
          {media.length ? mediaBlock : null}
        </>
      )}
      {meta ? <div className="flex items-center justify-between gap-2 text-xs text-muted">{meta}</div> : null}
    </article>
  );
}

function MediaFrame({ platform, media }: { platform: Platform; media: PreviewMedia[] }) {
  const aspect =
    platform === "pinterest" ? "aspect-[2/3]" : platform === "tiktok" ? "aspect-[9/16] max-h-80" : platform === "instagram" ? "aspect-[4/5]" : "aspect-[16/10]";
  const first = media[0];
  if (!first) {
    return (
      <div className={cn("grid w-full place-items-center rounded-2xl border border-dashed border-line-strong bg-wash text-faint", aspect)}>
        <div className="flex flex-col items-center gap-1.5 text-xs">
          {PLATFORM_META[platform].mediaRequired === "video" ? <Play className="size-5" aria-hidden /> : <ImageIcon className="size-5" aria-hidden />}
          {PLATFORM_META[platform].mediaRequired === "none" ? "No media" : "Media required"}
        </div>
      </div>
    );
  }
  return (
    <div className={cn("relative w-full overflow-hidden rounded-2xl bg-wash", aspect)}>
      {first.url ? (
        first.kind === "video" ? (
          <video src={first.url} className="size-full object-cover" muted playsInline controls aria-label={first.alt ?? "Post video"} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URLs aren't a fit for next/image caching
          <img src={first.url} alt={first.alt ?? ""} className="size-full object-cover" loading="lazy" />
        )
      ) : (
        <div className="grid size-full place-items-center text-faint">
          <ImageIcon className="size-5" aria-hidden />
        </div>
      )}
      {media.length > 1 ? (
        <span className="absolute right-2 top-2 rounded-full bg-ink/70 px-2 py-0.5 text-[11px] font-medium text-white">1/{media.length}</span>
      ) : null}
    </div>
  );
}

export function CharacterCount({ platform, content }: { platform: Platform; content: string }) {
  const limit = PLATFORM_META[platform].charLimit;
  const count = countCharacters(content);
  const over = count > limit;
  const near = !over && count > limit * 0.9;
  return (
    <span className={cn("font-mono text-[11px] tabular-nums", over ? "text-danger" : near ? "text-warning" : "text-muted")} aria-live="polite">
      {count.toLocaleString()}/{limit.toLocaleString()}
    </span>
  );
}
