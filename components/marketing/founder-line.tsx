import { FounderAvatar } from "@/components/marketing/founder-avatar";
import { demoVersionsStory } from "@/lib/demo/data";

/** The one line everything below was written from. */
export function FounderLine() {
  return (
    <div className="flex items-end gap-3">
      <FounderAvatar className="size-10" />
      <div className="min-w-0">
        <p className="mb-1.5 pl-1 text-[12.5px] text-muted">Maya, who makes Fernwood · example</p>
        <p className="max-w-2xl rounded-[24px] rounded-bl-md bg-ink px-5 py-3.5 text-[16px] leading-snug text-white shadow-[0_10px_24px_-14px_rgba(12,12,14,0.7)] sm:text-[17px]">
          {demoVersionsStory.source}
        </p>
      </div>
    </div>
  );
}
