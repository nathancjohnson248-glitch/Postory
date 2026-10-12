import { cn } from "@/lib/utils";

/**
 * The Postory mark: a P whose bowl opens into outgoing strokes — one story
 * leaving for many networks. Traced from the master artwork (331×548).
 *
 * `variant="glyph"` is the ink symbol used in the horizontal lockup.
 * `variant="tile"` is the symbol on a warm paper tile (favicon, app icon,
 * compact navigation).
 */
export const MARK_PATH =
  "M 84 12.1 C 72.2 18.7 50.8 30.7 36.5 38.7 C 22.2 46.7 8.1 54.6 5.2 56.2 L 0 59.1 0 303.7 C 0 460.8 0.3 548 1 547.8 C 1.5 547.6 27.6 532.9 58.9 515 L 115.9 482.5 115.7 351 L 115.5 219.5 112.7 211.5 C 105.6 191.5 93.8 178.6 68.7 163.8 C 62.2 159.9 57 156.7 57.2 156.5 C 58.8 155.1 105.8 131.1 121 124 C 143.4 113.4 186.1 95 216.2 82.9 C 227.7 78.3 237 74.3 237 74 C 236.9 73.7 226 67.3 212.7 59.7 C 199.4 52.2 170.5 35.6 148.5 23 C 126.5 10.4 107.8 0 107 0 C 106.2 0 95.8 5.4 84 12.1 M 233.5 107.9 C 214.2 114.9 183.4 126.1 165 132.8 C 124.7 147.5 115.9 150.9 118.5 151 C 119.6 151 136 151.9 155 153 C 223.3 156.9 319.6 162 325.3 162 L 331 162 330.8 145.4 L 330.5 128.8 324 125 C 320.4 123 307.3 115.4 294.8 108.2 C 282.4 100.9 271.3 95 270.3 95.1 C 269.3 95.1 252.8 100.9 233.5 107.9 M 117 175.5 C 117 175.6 125 180.1 134.8 185.3 C 159.8 198.6 221.6 232 260.2 253.1 L 292.8 270.9 311.9 260.2 L 331 249.5 331 225.3 L 331 201 329.4 201 C 325.2 201 143 178.9 120.2 175.6 C 118.5 175.3 117 175.3 117 175.5 M 154.6 231.8 C 153.6 232.7 153.9 351 154.9 351 C 156.3 351 262 290.3 262 289.5 C 262 289.3 256.7 286.4 250.2 282.9 C 240.9 278 178.9 244.3 159.3 233.5 C 157 232.2 154.9 231.5 154.6 231.8";

export const MARK_INK = "#0C0C0E";
export const MARK_PAPER = "#F7F3EA";

export function LogoMark({
  className,
  title,
  variant = "glyph",
}: {
  className?: string;
  title?: string;
  variant?: "glyph" | "tile";
}) {
  const a11y = { role: title ? "img" : undefined, "aria-hidden": title ? undefined : true, "aria-label": title } as const;
  if (variant === "tile") {
    return (
      <svg viewBox="0 0 64 64" className={cn("shrink-0", className)} {...a11y}>
        <rect width="64" height="64" rx="15" fill={MARK_PAPER} />
        <rect x="0.5" y="0.5" width="63" height="63" rx="14.5" fill="none" stroke={MARK_INK} strokeOpacity="0.08" />
        <path d={MARK_PATH} fill={MARK_INK} fillRule="evenodd" transform="translate(19.4 10.1) scale(0.08)" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 331 548" className={cn("shrink-0", className)} {...a11y}>
      <path d={MARK_PATH} fill="currentColor" fillRule="evenodd" />
    </svg>
  );
}

export function Logo({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-ink", className)}>
      <LogoMark className={cn("h-[24px] w-auto", markClassName)} />
      <span className="text-[21px] font-semibold leading-none tracking-[-0.04em] text-ink" aria-hidden>
        Postory
      </span>
      <span className="sr-only">Postory</span>
    </span>
  );
}
