import { cn } from "@/lib/utils";

/** The example business's app icon (Fernwood: a calm habit tracker) — only for labelled demos. */
export function DemoAvatar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8 shrink-0 rounded-full", className)} aria-hidden>
      <defs>
        <linearGradient id="fw-bg" x1="4" y1="2" x2="28" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#5FD39A" />
          <stop offset="1" stopColor="#13804F" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="16" fill="url(#fw-bg)" />
      <path d="M16 24.5V15.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M16 16.5C16 12.4 18.9 9.2 23 8.8C23.1 12.9 20.3 16.3 16 16.5Z" fill="#fff" />
      <path d="M16 19.2C16 16.2 13.8 13.9 10.8 13.6C10.7 16.6 12.9 19.1 16 19.2Z" fill="#fff" fillOpacity="0.82" />
    </svg>
  );
}
