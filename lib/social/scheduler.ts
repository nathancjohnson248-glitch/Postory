import "server-only";

import { log } from "@/lib/log";
import { publishDueScheduledPosts } from "./service";

const EVERY_MS = 60_000;
let started = false;
let running = false;

export function startScheduler() {
  if (started) return;
  started = true;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const sent = await publishDueScheduledPosts();
      if (sent) log.info("scheduled posts sent", { operation: "social.scheduler", count: sent });
    } catch (error) {
      log.warn("scheduler tick failed", { operation: "social.scheduler" }, error);
    } finally {
      running = false;
    }
  };
  setInterval(tick, EVERY_MS).unref?.();
}
