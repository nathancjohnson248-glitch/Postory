import { cn } from "@/lib/utils";

/**
 * The Postory mark: a single origin forking into outgoing arrows —
 * one story becoming many posts.
 *
 * `variant="glyph"` is the blue symbol used in the horizontal lockup.
 * `variant="tile"` is the white symbol on a blue tile (favicon, app icon,
 * compact navigation).
 */
const STROKES = [
  "M8 23V15C8 10.6 11.6 7 16 7H23",
  "M19.5 3.5L23 7L19.5 10.5",
  "M8 23C8 20 10.5 17.5 13.5 17.5H23",
  "M19.5 14L23 17.5L19.5 21",
];

export function LogoMark({
  className,
  title,
  variant = "glyph",
}: {
  className?: string;
  title?: string;
  variant?: "glyph" | "tile";
}) {
  const tile = variant === "tile";
  return (
    <svg
      viewBox={tile ? "0 0 32 32" : "4 1 22 27"}
      fill="none"
      className={cn("shrink-0", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {tile ? <rect width="32" height="32" rx="9" fill="#2F5BFF" /> : null}
      <g
        stroke={tile ? "#fff" : "#2F5BFF"}
        strokeWidth={tile ? 2.6 : 2.9}
        strokeLinecap="round"
        strokeLinejoin="round"
        transform={tile ? "translate(0.5 0.5)" : undefined}
      >
        {STROKES.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <circle cx={tile ? 8.5 : 8} cy={tile ? 25 : 24.5} r={tile ? 2.4 : 2.6} fill={tile ? "#fff" : "#2F5BFF"} />
    </svg>
  );
}

export function Logo({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <LogoMark className={cn("h-[26px] w-auto", markClassName)} />
      <span className="text-[21px] font-semibold leading-none tracking-[-0.04em] text-ink" aria-hidden>
        Postory
      </span>
      <span className="sr-only">Postory</span>
    </span>
  );
}
