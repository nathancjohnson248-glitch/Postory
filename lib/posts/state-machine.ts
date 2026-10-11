/**
 * Story post lifecycle. Pure and isomorphic so the server can enforce it and
 * the UI can decide which actions to offer.
 *
 *   draft ─┬─> awaiting_review ─┬─> approved ─┬─> publishing ─┬─> published
 *          │                    │             │               └─> failed ──┐
 *          │                    │             └─> scheduled ──> (provider) │
 *          └────────────────────┴─> rejected                               │
 *                                               failed ── retry ───────────┘
 */

export const POST_STATUSES = [
  "draft",
  "awaiting_review",
  "approved",
  "scheduled",
  "publishing",
  "published",
  "failed",
  "rejected",
] as const;

export type PostStatus = (typeof POST_STATUSES)[number];

const TRANSITIONS: Record<PostStatus, readonly PostStatus[]> = {
  draft: ["awaiting_review", "approved", "rejected"],
  awaiting_review: ["approved", "rejected", "draft"],
  approved: ["awaiting_review", "scheduled", "publishing", "rejected"],
  scheduled: ["approved", "publishing", "published", "failed"],
  publishing: ["published", "failed", "scheduled"],
  published: [],
  failed: ["publishing", "approved", "awaiting_review", "rejected"],
  rejected: ["awaiting_review", "draft"],
};

export function isPostStatus(value: unknown): value is PostStatus {
  return typeof value === "string" && (POST_STATUSES as readonly string[]).includes(value);
}

export function canTransition(from: PostStatus, to: PostStatus) {
  return TRANSITIONS[from].includes(to);
}

export class InvalidTransitionError extends Error {
  constructor(public readonly from: PostStatus, public readonly to: PostStatus) {
    super(`A ${STATUS_LABEL[from].toLowerCase()} post can't become ${STATUS_LABEL[to].toLowerCase()}.`);
    this.name = "InvalidTransitionError";
  }
}

export function assertTransition(from: PostStatus, to: PostStatus) {
  if (!canTransition(from, to)) throw new InvalidTransitionError(from, to);
}

/** Statuses whose text may still change. Scheduled posts live at the provider and must be unscheduled first. */
export function isEditable(status: PostStatus) {
  return status === "draft" || status === "awaiting_review" || status === "approved" || status === "failed" || status === "rejected";
}

/** Statuses from which "Publish now" is offered. */
export const PUBLISHABLE_FROM: readonly PostStatus[] = ["approved", "failed"];

/** Statuses from which "Schedule" is offered. */
export const SCHEDULABLE_FROM: readonly PostStatus[] = ["approved", "failed"];

/** Statuses that count as "needs the user's attention". */
export const NEEDS_REVIEW: readonly PostStatus[] = ["draft", "awaiting_review"];

/**
 * When text changes, does the post need to be reviewed again?
 * AI-made changes always do. A user's own edit stands as approved.
 */
export function statusAfterEdit(current: PostStatus, editor: "ai" | "user"): PostStatus {
  if (editor === "ai") return "awaiting_review";
  if (current === "failed" || current === "rejected" || current === "draft") return "awaiting_review";
  return current;
}

export const STATUS_LABEL: Record<PostStatus, string> = {
  draft: "Draft",
  awaiting_review: "Needs review",
  approved: "Approved",
  scheduled: "Scheduled",
  publishing: "Publishing",
  published: "Published",
  failed: "Failed",
  rejected: "Rejected",
};

export const STATUS_TONE: Record<PostStatus, "neutral" | "blue" | "success" | "warning" | "danger" | "ink"> = {
  draft: "neutral",
  awaiting_review: "warning",
  approved: "blue",
  scheduled: "ink",
  publishing: "blue",
  published: "success",
  failed: "danger",
  rejected: "neutral",
};
