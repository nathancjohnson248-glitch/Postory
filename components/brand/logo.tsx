import { cn } from "@/lib/utils";

/**
 * The Postory mark: a glossy blue rounded square with a glowing dome and two
 * eyes, the right one a little higher — curious, watching for the moment worth
 * posting. The eyes blink to a ~2px line every 4s (`mark-blink`) and glance
 * around while Postory works (`mark-thinking` on a parent); both stop for
 * reduced motion.
 *
 * Gradient/filter ids are fixed: every instance defines them identically, so
 * repeats on a page are harmless.
 */
export const MARK_BLUE = "#1670FF";

export const MARK_PATH = "M18.5 4H45.5C54.2 4 60 9.8 60 18.5V45.5C60 54.2 54.2 60 45.5 60H18.5C9.8 60 4 54.2 4 45.5V18.5C4 9.8 9.8 4 18.5 4Z";
const DOME_EDGE = "M2 36C10 23 21 17.6 32.2 17.6C43.4 17.6 54 23 62 36.6";

/** The eyes: [cx, cy, rx, ry]. */
export const MARK_EYES = [
  [27.2, 37.6, 4.75, 6.3],
  [41.3, 34.8, 4.6, 6.15],
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
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn("shrink-0", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <defs>
        <linearGradient id="pm-b" x1="32" y1="4" x2="32" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2A8CFF" />
          <stop offset="0.5" stopColor="#1670FF" />
          <stop offset="1" stopColor="#0A47EA" />
        </linearGradient>
        <linearGradient id="pm-d" x1="32" y1="17.6" x2="32" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#7DDBFF" />
          <stop offset="0.16" stopColor="#3FB2FF" />
          <stop offset="0.42" stopColor="#1A8BFF" />
          <stop offset="0.8" stopColor="#1872FF" />
          <stop offset="1" stopColor="#0D4FF0" />
        </linearGradient>
        <radialGradient id="pm-v" cx="32" cy="30" r="36" gradientUnits="userSpaceOnUse">
          <stop offset="0.6" stopColor="#0634C8" stopOpacity="0" />
          <stop offset="1" stopColor="#0634C8" stopOpacity="0.55" />
        </radialGradient>
        <linearGradient id="pm-e" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.55" stopColor="#EEF4FF" />
          <stop offset="1" stopColor="#BFD6FF" />
        </linearGradient>
        <filter id="pm-g1" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.4" />
        </filter>
        <filter id="pm-g2" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="0.45" />
        </filter>
        <filter id="pm-g3" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="0.9" />
        </filter>
        <clipPath id="pm-c">
          <path d={MARK_PATH} />
        </clipPath>
      </defs>
      <path d={MARK_PATH} fill="url(#pm-b)" />
      <g clipPath="url(#pm-c)">
        <path d="M8 4.6H56" stroke="#5FD8FF" strokeWidth="1.6" opacity="0.8" filter="url(#pm-g3)" />
        <path d={`${DOME_EDGE}V62H2Z`} fill="url(#pm-d)" />
        <path d={DOME_EDGE} fill="none" stroke="#9BE6FF" strokeWidth="3.2" opacity="0.55" filter="url(#pm-g1)" />
        <path d={DOME_EDGE} fill="none" stroke="#FFFFFF" strokeWidth="0.9" opacity="0.95" filter="url(#pm-g2)" />
        <path d={MARK_PATH} fill="url(#pm-v)" />
      </g>
      {MARK_EYES.map(([cx, cy, rx, ry]) => (
        <g key={cx} className={blink ? "mark-blink" : undefined}>
          <ellipse cx={cx - 0.3} cy={cy + 1.1} rx={rx} ry={ry} fill="#0A3BC9" opacity="0.4" filter="url(#pm-g3)" />
          <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="url(#pm-e)" />
          <ellipse cx={cx} cy={cy} rx={rx - 0.2} ry={ry - 0.2} fill="none" stroke="#A9C8FF" strokeWidth="0.35" opacity="0.6" />
        </g>
      ))}
    </svg>
  );
}

export function Logo({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-ink", className)}>
      <LogoMark className={cn("size-[30px]", markClassName)} />
      <span className="text-[20px] font-semibold leading-none tracking-[-0.04em] text-ink" aria-hidden>
        Postory
      </span>
      <span className="sr-only">Postory</span>
    </span>
  );
}
