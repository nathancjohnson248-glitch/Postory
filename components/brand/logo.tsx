import { cn } from "@/lib/utils";

/**
 * The Postory mark: a soft, glossy blue rounded square with two white eyes —
 * lit from the top (the highlight), deeper towards the edges, eyes set low
 * and a little left as if it's looking at what you're writing. The eyes blink
 * to a ~2px line on a 4s loop (`mark-blink`) and glance around while Postory
 * works (`mark-thinking` on a parent); both stop for reduced motion.
 *
 * Gradient/filter ids are fixed: every instance defines them identically, so
 * repeats on a page are harmless.
 */
export const MARK_BLUE = "#1D6BFF";

/** The body: a rounded square with very slightly full sides, in a 64×64 box. */
export const MARK_PATH =
  "M32 4C49.5 4 58.2 7.6 59.4 22.4C60.2 31 60.2 33 59.4 41.6C58.2 56.4 49.5 60 32 60C14.5 60 5.8 56.4 4.6 41.6C3.8 33 3.8 31 4.6 22.4C5.8 7.6 14.5 4 32 4Z";

/** The eyes, as [cx, cy, rx, ry]. */
export const MARK_EYES = [
  [25.2, 36.6, 4.2, 5.9],
  [37.6, 36.6, 4.2, 5.9],
] as const;

export function LogoMark({
  className,
  title,
  blink = true,
}: {
  className?: string;
  title?: string;
  /** Kept for older call sites; every mark is the same. */
  variant?: "glyph" | "tile";
  blink?: boolean;
}) {
  const eyeClass = blink ? "mark-blink" : undefined;
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn("shrink-0", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <defs>
        <linearGradient id="pm-body" x1="20" y1="4" x2="44" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#6FA6FF" />
          <stop offset="0.42" stopColor="#2F78FF" />
          <stop offset="1" stopColor="#0D47D9" />
        </linearGradient>
        <radialGradient id="pm-depth" cx="32" cy="27" r="34" gradientUnits="userSpaceOnUse">
          <stop offset="0.62" stopColor="#0A2E9E" stopOpacity="0" />
          <stop offset="1" stopColor="#0A2E9E" stopOpacity="0.45" />
        </radialGradient>
        <linearGradient id="pm-eye" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#DCE8FF" />
        </linearGradient>
        <filter id="pm-soft" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.6" />
        </filter>
        <filter id="pm-softer" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1" />
        </filter>
        <clipPath id="pm-clip">
          <path d={MARK_PATH} />
        </clipPath>
      </defs>
      <path d={MARK_PATH} fill="url(#pm-body)" />
      <g clipPath="url(#pm-clip)">
        <path d={MARK_PATH} fill="url(#pm-depth)" />
        <ellipse cx="30" cy="16" rx="20" ry="9" fill="#FFFFFF" opacity="0.5" filter="url(#pm-soft)" />
        <ellipse cx="27" cy="13.2" rx="10" ry="3.2" fill="#FFFFFF" opacity="0.85" filter="url(#pm-softer)" />
        <ellipse cx="32" cy="63" rx="22" ry="5" fill="#7FB0FF" opacity="0.35" filter="url(#pm-soft)" />
      </g>
      {MARK_EYES.map(([cx, cy, rx, ry]) => (
        <g key={cx} className={eyeClass}>
          <ellipse cx={cx} cy={cy + 1} rx={rx} ry={ry} fill="#0A2E9E" opacity="0.35" filter="url(#pm-softer)" />
          <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="url(#pm-eye)" />
        </g>
      ))}
    </svg>
  );
}

export function Logo({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-ink", className)}>
      <LogoMark className={cn("size-[28px]", markClassName)} />
      <span className="text-[20px] font-semibold leading-none tracking-[-0.04em] text-ink" aria-hidden>
        Postory
      </span>
      <span className="sr-only">Postory</span>
    </span>
  );
}
