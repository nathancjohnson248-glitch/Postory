import "server-only";

import { PLATFORMS, type Platform } from "./platforms";
import { activeProvider } from "./provider";

/** Networks the active provider can't connect yet (empty when it supports them all). */
export function unavailablePlatforms(): Platform[] {
  const supported = activeProvider()?.platforms;
  return supported ? PLATFORMS.filter((p) => !supported.includes(p)) : [];
}
