import { z } from "zod";
import { PLATFORMS } from "@/lib/social/platforms";

/**
 * Two layers of schema:
 *  - *Model* schemas are what the model is asked to produce (kept free of
 *    length constraints so they compile to OpenAI strict JSON schema).
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

export const ModelGeneration = z.object({
  storyTitle: z.string(),
  summary: z.string(),
  angles: z.array(z.string()),
  posts: z.array(ModelGeneratedPost),
  missingInformation: z.array(z.string()),
  schedulingSuggestion: z.string().nullable(),
});

export const ValidatedGeneration = z.object({
  storyTitle: z.string().trim().min(1).max(120),
  summary: z.string().trim().max(600),
  angles: z.array(z.string().trim().min(1).max(240)).min(1).max(6),
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
    .min(1)
    .max(PLATFORMS.length),
  missingInformation: z.array(z.string().trim().max(240)).max(6),
  schedulingSuggestion: z.string().trim().max(300).nullable(),
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
