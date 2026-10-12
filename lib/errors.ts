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
};

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: ActionError };

export function ok<T>(data: T): ActionResult<T>;
export function ok(): ActionResult<undefined>;
export function ok<T>(data?: T): ActionResult<T | undefined> {
  return { ok: true, data };
}

export function fail(code: string, message: string, action?: ActionError["action"]): { ok: false; error: ActionError } {
  return { ok: false, error: { code, message, ...(action ? { action } : {}) } };
}

export class UserFacingError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly action?: ActionError["action"],
  ) {
    super(message);
    this.name = "UserFacingError";
  }
}

function networkName(platform?: string) {
  return platform && isPlatform(platform) ? PLATFORM_META[platform].name : "The network";
}

/** Translate a LetMePost error code into something a business owner can act on. */
export function describeSocialError(
  code: string,
  context: { platform?: string; message?: string; remediation?: string; operation?: "connect" | "publish" | "schedule" | "sync" } = {},
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
    case "preflight_failed":
    case "validation_failed":
      return { code, message: `${context.message ?? `${name} won't accept this post as written.`}${remediation}` };
    case "rate_limited":
      return { code, message: `${name} is limiting how often you can post right now. Wait a few minutes and try again.` };
    case "platform_unavailable":
      return { code, message: `${name} is having trouble right now. Nothing was published. Try again shortly.` };
    case "platform_not_enabled":
      return { code, message: `${name} isn't available through Postory's publishing provider yet.` };
    case "timeout":
    case "network_error":
      return {
        code,
        message:
          context.operation === "publish" || context.operation === "schedule"
            ? `We couldn't confirm the result with ${name}. Retrying is safe — Postory won't post twice.`
            : "Postory couldn't reach its publishing provider. Try again in a moment.",
      };
    case "unauthenticated":
    case "unauthorized":
      return context.operation === "connect"
        ? {
            code: "connect_not_permitted",
            message:
              "LetMePost didn't let Postory start this connection. LetMePost currently only allows new accounts to be connected from its own dashboard, so in-app connections aren't available yet.",
          }
        : { code, message: "Postory's publishing provider rejected its credentials. This is on our side — we've logged it." };
    case "not_found":
      return { code, message: `${name} couldn't find that account or post. It may have been removed. Reconnect and try again.` };
    case "idempotency_conflict":
      return { code, message: "This post is already being processed. Refresh in a moment to see the result." };
    default:
      return { code: code || "unknown_error", message: context.message ? `${context.message}${remediation}` : "Something went wrong. Try again." };
  }
}
