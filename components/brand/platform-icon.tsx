import { siBluesky, siFacebook, siInstagram, siPinterest, siThreads, siTiktok, siX } from "simple-icons";
import type { Platform } from "@/lib/social/platforms";
import { PLATFORM_META } from "@/lib/social/platforms";
import { cn } from "@/lib/utils";

const ICONS: Partial<Record<Platform, { path: string; hex: string }>> = {
  x: siX,
  instagram: siInstagram,
  facebook: siFacebook,
  threads: siThreads,
  bluesky: siBluesky,
  pinterest: siPinterest,
  tiktok: siTiktok,
};

const TILE_BG: Record<Platform, string> = {
  x: "#0c0c0e",
  linkedin: "#0a66c2",
  instagram: "#e1306c",
  threads: "#0c0c0e",
  facebook: "#0866ff",
  bluesky: "#1185fe",
  pinterest: "#bd081c",
  tiktok: "#0c0c0e",
};

/** Network glyph. `tile` renders it white on the network's colour. */
export function PlatformIcon({
  platform,
  className,
  tile = false,
  label = false,
}: {
  platform: Platform;
  className?: string;
  tile?: boolean;
  label?: boolean;
}) {
  const icon = ICONS[platform];
  const name = PLATFORM_META[platform].name;

  const glyph = icon ? (
    <svg viewBox="0 0 24 24" className={cn(tile ? "size-[55%]" : "size-full")} fill="currentColor" aria-hidden>
      <path d={icon.path} />
    </svg>
  ) : (
    // LinkedIn's mark is not available under an open licence; use a plain monogram.
    <span className={cn("font-bold leading-none tracking-[-0.04em]", tile ? "text-[0.6em]" : "text-[0.75em]")} aria-hidden>
      in
    </span>
  );

  if (tile) {
    return (
      <span
        className={cn("inline-grid size-7 shrink-0 place-items-center rounded-[9px] text-white", className)}
        style={{ backgroundColor: TILE_BG[platform] }}
        role={label ? undefined : "img"}
        aria-label={label ? undefined : name}
      >
        {glyph}
      </span>
    );
  }

  return (
    <span className={cn("inline-grid size-4 shrink-0 place-items-center text-ink", className)} role="img" aria-label={name}>
      {glyph}
    </span>
  );
}
