import type { BUSINESS_TYPES } from "@/lib/validation/schemas";

type BusinessType = (typeof BUSINESS_TYPES)[number];

/**
 * How each kind of business shows up in onboarding: who it is, and the kind
 * of stories Postory will lean towards. Also given to the writer as context.
 */
export const BUSINESS_TYPE_DETAILS: Record<BusinessType, { icon: string; blurb: string; focus: string }> = {
  "Indie founder or startup": {
    icon: "rocket",
    blurb: "You're building a product — an app, a SaaS, a startup.",
    focus: "Releases, milestones, and the decisions behind them.",
  },
  "Creator or personal brand": {
    icon: "pen",
    blurb: "People follow you — your writing, videos, teaching or taste.",
    focus: "Ideas, opinions and stories, in your own voice.",
  },
  "Online business": {
    icon: "bag",
    blurb: "You sell online — products, downloads or subscriptions.",
    focus: "New products, offers, and real moments with customers.",
  },
  "Local business": {
    icon: "store",
    blurb: "People come to you — a shop, café, studio or practice.",
    focus: "What's on this week, new arrivals, and reasons to visit.",
  },
  "Agency or studio": {
    icon: "layers",
    blurb: "You make things for clients.",
    focus: "Finished work, how you work, and what clients got out of it.",
  },
  "Professional service": {
    icon: "briefcase",
    blurb: "Consulting, legal, finance, health, coaching.",
    focus: "Expertise, answers to common questions, and trust.",
  },
  "Something else": {
    icon: "sparkle",
    blurb: "A nonprofit, community, side project or something new.",
    focus: "Updates, milestones and the story behind them.",
  },
};
