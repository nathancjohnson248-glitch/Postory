import { z } from "zod";
import { PLATFORMS } from "@/lib/social/platforms";
import { PLAN_IDS } from "@/lib/billing/plans";

/** Centralised input validation. Nothing from the browser is trusted unvalidated. */

const trimmed = (max: number) => z.string().trim().max(max);

export const emailSchema = z.email("Enter a valid email address.").trim().toLowerCase().max(254);
export const passwordSchema = z.string().min(8, "Use at least 8 characters.").max(128);

export const SignInSchema = z.object({ email: emailSchema, password: z.string().min(1, "Enter your password.").max(128) });
export const SignUpSchema = z.object({
  name: trimmed(80).min(1, "Tell us your name."),
  email: emailSchema,
  password: passwordSchema,
});

export const safeNextPath = z
  .string()
  .trim()
  .refine((v) => v.startsWith("/") && !v.startsWith("//") && !v.includes("\\"), "Invalid redirect")
  .catch("/app");

export const BUSINESS_TYPES = [
  "Software or app",
  "Ecommerce",
  "Local business",
  "Restaurant or hospitality",
  "Agency or services",
  "Creator or media",
  "Health and wellness",
  "Nonprofit",
  "Other",
] as const;

const optionalUrl = z
  .string()
  .trim()
  .max(300)
  .transform((v) => (v && !/^https?:\/\//i.test(v) ? `https://${v}` : v))
  .refine((v) => !v || z.url().safeParse(v).success, "Enter a valid website, like example.com.")
  .transform((v) => v || null);

export const timezoneSchema = z
  .string()
  .trim()
  .max(64)
  .refine((tz) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, "Unknown timezone")
  .catch("UTC");

export const BusinessSchema = z.object({
  businessName: trimmed(120).min(1, "What's your business called?"),
  businessDescription: trimmed(1000).min(10, "Give Postory a sentence or two about what you do."),
  businessType: z.enum(BUSINESS_TYPES, { message: "Pick the closest fit." }),
  websiteUrl: optionalUrl,
  timezone: timezoneSchema,
});

export const VOICE_PRESETS = ["Casual", "Professional", "Bold", "Technical", "Funny", "Minimal", "Founder-led"] as const;

export const VoiceSchema = z.object({
  presets: z.array(z.enum(VOICE_PRESETS)).max(VOICE_PRESETS.length).default([]),
  notes: trimmed(600).default(""),
});

export const ProfileSchema = z.object({
  name: trimmed(80).min(1, "Enter your name."),
  timezone: timezoneSchema,
});

export const MemorySchema = z.object({
  category: z.enum(["business", "product", "audience", "voice", "brand", "milestone", "facts", "preferences", "approved_content"]),
  key: trimmed(120).min(1, "Give this a short label."),
  value: trimmed(4000).min(1, "Add the detail."),
});

export const platformSchema = z.enum(PLATFORMS);
export const planSchema = z.enum(PLAN_IDS);
export const idSchema = z.uuid();

export const CreateStorySchema = z.object({
  sourceText: trimmed(8000).min(8, "Tell Postory a little more about what happened."),
  sourceType: z.enum(["text", "voice", "imported", "manual"]).default("text"),
  platforms: z.array(platformSchema).min(1, "Choose at least one network.").max(PLATFORMS.length),
});

export const EditPostSchema = z.object({
  postId: idSchema,
  content: z.string().max(70000),
  expectedVersion: z.number().int().positive(),
});

export const AdaptPostSchema = z.object({
  postId: idSchema,
  instruction: trimmed(500).min(2, "Tell Postory what to change."),
});

/** Schedule times arrive as ISO strings with an offset (computed in the user's timezone on the client). */
export const ScheduleSchema = z.object({
  postId: idSchema,
  scheduledFor: z.iso.datetime({ offset: true }).transform((v) => new Date(v)),
});

export const AssistantSchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: trimmed(4000).min(1) }))
    .min(1)
    .max(24),
});

export function firstError(error: z.ZodError) {
  return error.issues[0]?.message ?? "Check the form and try again.";
}

export function fieldErrors(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}
