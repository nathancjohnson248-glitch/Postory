import { cn } from "@/lib/utils";

/**
 * The Postory mark: one rounded-square path in #1D6BFF with two white
 * eyes, no stroke. The eyes blink — they squeeze to a ~2px line — on a 4s
 * loop (CSS `mark-blink`, off for reduced motion), and glance around while
 * Postory is working (`mark-thinking` on a parent).
 */
export const MARK_BLUE = "#1D6BFF";

/** A rounded square in a 64×64 box. */
export const MARK_PATH = "M32 3C53.6 3 61 10.4 61 32C61 53.6 53.6 61 32 61C10.4 61 3 53.6 3 32C3 10.4 10.4 3 32 3Z";

/** The eyes, as [cx, cy, rx, ry] in the same 64×64 box. */
export const MARK_EYES = [
  [23.5, 29, 4.6, 7.2],
  [40.5, 29, 4.6, 7.2],
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
      <path d={MARK_PATH} fill={MARK_BLUE} />
      {MARK_EYES.map(([cx, cy, rx, ry]) => (
        <ellipse key={cx} cx={cx} cy={cy} rx={rx} ry={ry} fill="#fff" className={blink ? "mark-blink" : undefined} />
      ))}
    </svg>
  );
}

export function Logo({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-ink", className)}>
      <LogoMark className={cn("size-[26px]", markClassName)} />
      <span className="text-[20px] font-semibold leading-none tracking-[-0.04em] text-ink" aria-hidden>
        Postory
      </span>
      <span className="sr-only">Postory</span>
    </span>
  );
}
