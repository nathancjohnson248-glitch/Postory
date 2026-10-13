import { z } from "zod";
import { PLATFORMS } from "@/lib/social/platforms";

/**
 * Two layers of schema:
 *  - *Model* schemas are what the model is asked to produce (kept free of
 *    length constraints, which keeps the JSON Schema the model sees simple).
 *  - *Validated* schemas are applied afterwards. Model output is never
 *    trusted until it passes these.
 */

export const ModelGeneratedPost = z.object({
  platform: z.enum(PLATFORMS),
  content: z.string(),
  angle: z.string(),
  reasoning: z.string(),
  mediaNeeded: z.boolean(),
  mediaSuggestion: z.string().nullable(),
});

const FIT = z.enum(["strong", "good", "weak"]);
const MEDIA_KIND = z.enum(["none", "real_screenshot", "real_photo", "generated_visual", "video"]);

export const ModelGeneration = z.object({
  // First, so the model commits to the facts before it writes anything.
  facts: z.array(z.string()),
  // Then its read of the story, before any writing.
  eventType: z.string(),
  significance: z.string(),
  strongestAngle: z.string(),
  strongestAngleWhy: z.string(),
  networkFit: z.array(z.object({ platform: z.enum(PLATFORMS), fit: FIT, why: z.string() })),
  media: z.object({ kind: MEDIA_KIND, why: z.string() }),
  repetition: z.string().nullable(),
  followUps: z.array(z.string()),
  seriesIdea: z.string().nullable(),
  storyTitle: z.string(),
  summary: z.string(),
  angles: z.array(z.string()),
  posts: z.array(ModelGeneratedPost),
  missingInformation: z.array(z.string()),
  schedulingSuggestion: z.string().nullable(),
  needsMoreDetail: z.boolean(),
});

export const ValidatedGeneration = z.object({
  facts: z.array(z.string().trim().min(1).max(300)).max(24).default([]),
  eventType: z.string().trim().max(60).catch(""),
  significance: z.string().trim().max(400).catch(""),
  strongestAngle: z.string().trim().max(240).catch(""),
  strongestAngleWhy: z.string().trim().max(400).catch(""),
  networkFit: z.array(z.object({ platform: z.enum(PLATFORMS), fit: FIT, why: z.string().trim().max(240) })).max(PLATFORMS.length).catch([]),
  media: z.object({ kind: MEDIA_KIND, why: z.string().trim().max(300) }).nullable().catch(null),
  repetition: z.string().trim().max(400).nullable().catch(null),
  followUps: z.array(z.string().trim().min(1).max(400)).max(4).catch([]),
  seriesIdea: z.string().trim().max(500).nullable().catch(null),
  storyTitle: z.string().trim().min(1).max(120),
  summary: z.string().trim().max(600),
  angles: z.array(z.string().trim().min(1).max(240)).max(6),
  posts: z
    .array(
      z.object({
        platform: z.enum(PLATFORMS),
        content: z.string().trim().min(1).max(8000),
        angle: z.string().trim().max(240),
        reasoning: z.string().trim().max(600),
        mediaNeeded: z.boolean(),
        mediaSuggestion: z.string().trim().max(500).nullable(),
      }),
    )
    .max(PLATFORMS.length),
  missingInformation: z.array(z.string().trim().max(240)).max(6),
  schedulingSuggestion: z.string().trim().max(300).nullable(),
  needsMoreDetail: z.boolean().default(false),
});

export type GenerationResult = z.infer<typeof ValidatedGeneration>;

export const ModelAdaptation = z.object({
  content: z.string(),
  changeSummary: z.string(),
});

export const ValidatedAdaptation = z.object({
  content: z.string().trim().min(1).max(8000),
  changeSummary: z.string().trim().max(300),
});

export const ModelAssistantReply = z.object({
  reply: z.string(),
  proposals: z.array(
    z.object({
      type: z.enum(["edit_post", "reschedule_post", "create_story"]),
      postId: z.string().nullable(),
      instruction: z.string().nullable(),
      scheduledFor: z.string().nullable(),
      sourceText: z.string().nullable(),
      label: z.string(),
    }),
  ),
});

export const ValidatedAssistantReply = z.object({
  reply: z.string().trim().min(1).max(4000),
  proposals: z
    .array(
      z.discriminatedUnion("type", [
        z.object({ type: z.literal("edit_post"), postId: z.uuid(), instruction: z.string().trim().min(1).max(500), label: z.string().trim().max(120) }),
        z.object({ type: z.literal("reschedule_post"), postId: z.uuid(), scheduledFor: z.iso.datetime({ offset: true }), label: z.string().trim().max(120) }),
        z.object({ type: z.literal("create_story"), sourceText: z.string().trim().min(1).max(4000), label: z.string().trim().max(120) }),
      ]),
    )
    .max(8),
});

export type AssistantReply = z.infer<typeof ValidatedAssistantReply>;
export type AssistantProposal = AssistantReply["proposals"][number];

export const ModelReplyDraft = z.object({ reply: z.string(), category: z.enum(["needs_reply", "potential_customer", "mention"]) });

/** The content planner: opportunities grounded in what Postory knows, plus questions where it doesn't. */
export const ModelPlan = z.object({
  summary: z.string(),
  ideas: z.array(
    z.object({
      title: z.string(),
      why: z.string(),
      basedOn: z.enum(["recent_story", "memory", "network_gap", "follow_up"]),
      networks: z.array(z.enum(PLATFORMS)),
      day: z.string().nullable(),
      storyPrompt: z.string(),
      question: z.string().nullable(),
    }),
  ),
  questions: z.array(z.string()),
});

export const ValidatedPlan = z.object({
  summary: z.string().trim().min(1).max(600),
  ideas: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(120),
        why: z.string().trim().min(1).max(400),
        basedOn: z.enum(["recent_story", "memory", "network_gap", "follow_up"]),
        networks: z.array(z.enum(PLATFORMS)).max(8),
        day: z.string().trim().max(40).nullable(),
        storyPrompt: z.string().trim().min(1).max(1200),
        question: z.string().trim().max(300).nullable(),
      }),
    )
    .max(10),
  questions: z.array(z.string().trim().min(1).max(300)).max(6),
});
export type Plan = z.infer<typeof ValidatedPlan>;
