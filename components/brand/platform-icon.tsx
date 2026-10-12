import { siBluesky, siFacebook, siInstagram, siPinterest, siThreads, siTiktok, siX } from "simple-icons";
import type { Platform } from "@/lib/social/platforms";
import { PLATFORM_META } from "@/lib/social/platforms";
import { cn } from "@/lib/utils";

/** LinkedIn's "in" glyph — used only to label the LinkedIn integration. */
const LINKEDIN_IN =
  "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452z";

const ICONS: Partial<Record<Platform, { path: string; hex: string }>> = {
  linkedin: { path: LINKEDIN_IN, hex: "0A66C2" },
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
    <svg viewBox="0 0 24 24" className={cn(tile ? (platform === "linkedin" ? "size-[50%]" : "size-[55%]") : "size-full")} fill="currentColor" aria-hidden>
      <path d={icon.path} />
    </svg>
  ) : null;

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
