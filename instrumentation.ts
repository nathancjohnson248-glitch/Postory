/**
 * Runs once when the Node server starts. Postory's own scheduler: every minute,
 * send scheduled posts whose time has come (only used when the social provider
 * publishes but doesn't schedule, i.e. Nango). Each post is claimed in the
 * database before sending, so overlapping ticks or instances can't double-post.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const { startScheduler } = await import("./lib/social/scheduler");
  startScheduler();
}
