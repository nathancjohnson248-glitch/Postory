"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogoMark } from "@/components/brand/logo";
import { PlatformIcon } from "@/components/brand/platform-icon";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { GenerationProgress, WritingMark, type StageId } from "@/components/app/create/generation-progress";
import { PLATFORMS, PLATFORM_META, type Platform } from "@/lib/social/platforms";
import { cn } from "@/lib/utils";

/**
 * Write posts for a saved story: all of them when generation was interrupted,
 * or just the networks it doesn't have yet (`written`), e.g. after a partial run.
 */
export function GenerateForStory({
  storyId,
  defaultPlatforms,
  enabled,
  reason,
  written = [],
  retry = [],
}: {
  storyId: string;
  defaultPlatforms: Platform[];
  enabled: boolean;
  reason?: string;
  written?: Platform[];
  /** Networks the last run didn't finish, preselected for another attempt. */
  retry?: Platform[];
}) {
  const router = useRouter();
  const available = PLATFORMS.filter((p) => !written.includes(p));
  const initial = (retry.length ? retry : defaultPlatforms.length ? defaultPlatforms : ["x", "linkedin", "instagram"]).filter((p): p is Platform => available.includes(p as Platform));
  const [platforms, setPlatforms] = useState<Platform[]>(initial);
  const adding = written.length > 0;
  const [stage, setStage] = useState<StageId | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storyId, platforms }) });
      if (!res.ok || !res.body) throw (await res.json().catch(() => null))?.error ?? { message: "Generation couldn't start." };
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines.filter(Boolean)) {
          const event = JSON.parse(line);
          if (event.type === "stage") setStage(event.stage);
          if (event.type === "error") throw event.error;
          if (event.type === "needs_detail") throw { message: `Postory needs more detail about this story to write it without guessing. ${event.questions?.[0] ?? ""}`.trim() };
          if (event.type === "done") {
            router.refresh();
            return;
          }
        }
      }
    } catch (e) {
      setError((e as { message?: string })?.message ?? "Something went wrong.");
    } finally {
      setRunning(false);
      setStage(null);
    }
  }

  return (
    <div className="rounded-3xl bg-surface p-6 shadow-soft ring-1 ring-line">
      <h2 className="text-[15px] font-semibold">{retry.length ? `${retry.length === 1 ? "1 network needs" : `${retry.length} networks need`} another attempt` : adding ? "Add another network" : "No posts yet"}</h2>
      <p className="mt-1 text-[13.5px] text-muted">
        {adding
          ? "Postory writes a version for each network you pick, from the same story. Your existing posts stay as they are."
          : "This story is saved. Choose networks and Postory will write a version for each."}
      </p>
      {error ? <Notice tone="danger" title={error} className="mt-4" /> : null}
      {running ? (
        <div className="mt-5 flex flex-col gap-6">
          <WritingMark />
          <GenerationProgress current={stage} />
        </div>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap gap-2">
            {available.map((p) => {
              const on = platforms.includes(p);
              return (
                <button
                  key={p}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setPlatforms((cur) => (on ? cur.filter((x) => x !== p) : [...cur, p]))}
                  className={cn("flex h-9 items-center gap-2 rounded-full pl-1 pr-3 text-[13px] font-medium ring-1 transition-colors", on ? "bg-ink text-white ring-ink" : "bg-surface text-ink-soft ring-line")}
                >
                  <PlatformIcon platform={p} tile className="size-7 rounded-full" />
                  {PLATFORM_META[p].name}
                </button>
              );
            })}
          </div>
          <div className="mt-5 flex items-center justify-between gap-3">
            <p className="text-[13px] text-muted">{enabled ? "Uses one AI generation." : reason}</p>
            <Button variant="accent" icon={<LogoMark className="size-[18px]" blink={false} />} disabled={!enabled || !platforms.length} onClick={run}>
              {adding ? "Write these" : "Generate posts"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
