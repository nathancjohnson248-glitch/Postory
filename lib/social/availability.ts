import "server-only";

import { PLATFORMS, type Platform } from "./platforms";
import { activeProvider } from "./provider";

/** Networks the active provider can't connect yet (empty when it supports them all). */
export async function unavailablePlatforms(): Promise<Platform[]> {
  const p = activeProvider();
  const supported = p?.availablePlatforms ? await p.availablePlatforms() : p?.platforms;
  return supported ? PLATFORMS.filter((x) => !supported.includes(x)) : [];
}

/** Whether connecting opens in-page (Nango's Connect UI) rather than in a new tab. */
export function connectsInPage() {
  return activeProvider()?.name === "nango";
}
