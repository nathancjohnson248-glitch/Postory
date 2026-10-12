import { cn } from "@/lib/utils";

/** The example founder (Maya, who makes Fernwood) — only for labelled demos. */
export function FounderAvatar({ className }: { className?: string }) {
  return (
    <span
      className={cn("grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#ffd9b8] to-[#f2a77c] text-[13px] font-semibold text-[#6b3416] ring-2 ring-white", className)}
      aria-hidden
    >
      M
    </span>
  );
}
