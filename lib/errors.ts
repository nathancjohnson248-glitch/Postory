import { PLATFORM_META, isPlatform } from "@/lib/social/platforms";

/**
 * Every server action and API route returns this shape. Errors carry a
 * message written for the user (what happened, why, what to do) — never a
 * stack trace or a raw provider payload.
 */
export type ActionError = {
  code: string;
  message: string;
  /** Optional suggested next step for the UI to render as a button. */
  action?: { label: string; href: string };
  /** A plan limit or plan-only feature: the UI shows the upgrade modal instead of a toast. */
  upgrade?: Upgrade;
};

/** What ran out, and what the next plan would give. Built only on the server, from the real plan. */
export type Upgrade = {
  title: string;
  body: string;
  /** The plan the person is on (null = no plan yet). */
  currentPlan: string | null;
  /** The next plan up and what it includes, or null if they're already on the top plan. */
  next: { id: string; name: string; offer: string } | null;
};

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: ActionError };

export function ok<T>(data: T): ActionResult<T>;
export function ok(): ActionResult<undefined>;
export function ok<T>(data?: T): ActionResult<T | undefined> {
  return { ok: true, data };
}

export function fail(code: string, message: string, action?: ActionError["action"], upgrade?: Upgrade): { ok: false; error: ActionError } {
  return { ok: false, error: { code, message, ...(action ? { action } : {}), ...(upgrade ? { upgrade } : {}) } };
}

export class UserFacingError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly action?: ActionError["action"],
    public readonly upgrade?: Upgrade,
  ) {
    super(message);
    this.name = "UserFacingError";
  }
}

function networkName(platform?: string) {
  return platform && isPlatform(platform) ? PLATFORM_META[platform].name : "The network";
}

/** Translate a network error code into something a business owner can act on. */
export function describeSocialError(
  code: string,
  context: { platform?: string; message?: string; remediation?: string; operation?: "connect" | "publish" | "schedule" | "sync"; outcomeUnknown?: boolean } = {},
): ActionError {
  const name = networkName(context.platform);
  const remediation = context.remediation ? ` ${context.remediation}` : "";
  switch (code) {
    case "platform_auth_failed":
      return {
        code,
        message: `${name} didn't accept Postory's saved connection. It may have expired or been revoked. Reconnect ${name} and try again.`,
        action: { label: `Reconnect ${name}`, href: "/app/connections" },
      };
    case "platform_rejected":
      return { code, message: `${name} rejected this post.${remediation || " Check the content and try again."}` };
    case "rate_limited":
      return { code, message: `${name} is limiting how often Postory can post right now. Wait a few minutes and try again.` };
    case "platform_unavailable":
      return context.outcomeUnknown
        ? { code: "outcome_unknown", message: `${name} had a problem mid-request, so Postory can't tell whether it posted. Check ${name} before retrying.` }
        : { code, message: `${name} is having trouble right now. Nothing was published. Try again shortly.` };
    case "platform_not_enabled":
      return { code, message: context.message ?? `Postory can't do that on ${name} yet.` };
    case "media_required":
    case "media_too_large":
    case "media_unavailable":
      return { code, message: context.message ?? `${name} couldn't take the image on this post.` };
    case "timeout":
    case "network_error":
      return context.outcomeUnknown || context.operation === "publish"
        ? { code: "outcome_unknown", message: `Postory couldn't get an answer from ${name}, so it can't tell whether it posted. Check ${name} before retrying, so it doesn't post twice.` }
        : { code, message: `Postory couldn't reach ${name}. Try again in a moment.` };
    case "unauthenticated":
    case "unauthorized":
      return context.operation === "connect"
        ? { code: "connect_not_permitted", message: `${name} didn't let Postory connect. Make sure you approve every permission on ${name}'s screen, then try again.` }
        : {
            code,
            message: `${name} refused this request. The connection may be missing a permission. Reconnect ${name} and approve every permission.`,
            action: { label: `Reconnect ${name}`, href: "/app/connections" },
          };
    case "not_found":
      return { code, message: `${name} couldn't find that account or post. It may have been removed. Reconnect and try again.` };
    case "unexpected_response":
      return { code, message: `${name} answered in a way Postory didn't expect, so it can't tell whether it worked. Check ${name} before retrying.` };
    default:
      return { code: code || "unknown_error", message: context.message ? `${context.message}${remediation}` : "Something went wrong. Try again." };
  }
}
