/**
 * DEMO DATA — for public marketing pages and labelled previews only.
 * "Fernwood" is a fictional business. Never render this inside the
 * authenticated app as if it were the user's data.
 */
import type { Platform } from "@/lib/social/platforms";
import type { PostStatus } from "@/lib/posts/state-machine";

export const DEMO_LABEL = "Example";

export const demoBusiness = {
  name: "Fernwood",
  handle: "@fernwoodapp",
  description: "A calm habit tracker for iPhone.",
};

export const demoStory = {
  title: "iOS launch",
  source: "We launched our iOS app today and got 37 downloads in the first hour.",
  angles: ["First-hour milestone", "Behind the launch", "What's next for early users"],
};

export type DemoPost = { platform: Platform; status: PostStatus; when: string; content: string; image?: string };

export const demoPosts: DemoPost[] = [
  {
    platform: "x",
    status: "published",
    when: "Today, 9:04 AM",
    content: "37 downloads in the first hour.\n\nfernwood is officially live on iOS.",
  },
  {
    platform: "linkedin",
    status: "scheduled",
    when: "Tomorrow, 8:30 AM",
    content:
      "Today we launched Fernwood on iOS.\n\nWithin the first hour, 37 people downloaded it. For a small team that spent months on the details, that first hour meant a lot.\n\nIf you're one of the 37 — thank you. Tell us what you'd like to see next.",
  },
  {
    platform: "instagram",
    status: "awaiting_review",
    when: "Needs review",
    content: "WE'RE LIVE ON IOS.\n\n37 downloads in the first hour.\n\nThis is just the beginning.",
    image: "/demo/fernwood-launch.svg",
  },
  {
    platform: "threads",
    status: "approved",
    when: "Approved",
    content: "okay we actually shipped it. fernwood is on the app store and 37 of you grabbed it in the first hour 🫶",
  },
];

export const demoCalendar: { day: number; platform: Platform; time: string; title: string; status: PostStatus }[] = [
  { day: 3, platform: "linkedin", time: "8:30", title: "Hiring our first designer", status: "published" },
  { day: 6, platform: "x", time: "12:00", title: "Widget update", status: "published" },
  { day: 9, platform: "instagram", time: "17:15", title: "Behind the launch", status: "published" },
  { day: 12, platform: "x", time: "9:04", title: "37 downloads in the first hour", status: "published" },
  { day: 13, platform: "linkedin", time: "8:30", title: "Today we launched on iOS", status: "scheduled" },
  { day: 15, platform: "threads", time: "19:00", title: "okay we actually shipped it", status: "scheduled" },
  { day: 18, platform: "bluesky", time: "10:30", title: "Dark mode is here", status: "scheduled" },
  { day: 22, platform: "facebook", time: "13:00", title: "Community Q&A", status: "approved" },
  { day: 26, platform: "instagram", time: "18:00", title: "Customer spotlight", status: "awaiting_review" },
];

export const demoAnalytics = {
  headline: "Followers up 1,284 this month.",
  bullets: ["Instagram grew fastest (+612).", "The iOS launch post was your #1 post.", "Posts with video drew 3.1× the engagement of text-only posts."],
  series: [12, 18, 15, 22, 30, 28, 41, 38, 52, 49, 63, 71],
  networks: [
    { platform: "instagram" as Platform, followers: "+612", share: 0.48 },
    { platform: "linkedin" as Platform, followers: "+344", share: 0.27 },
    { platform: "x" as Platform, followers: "+251", share: 0.19 },
    { platform: "threads" as Platform, followers: "+77", share: 0.06 },
  ],
};
