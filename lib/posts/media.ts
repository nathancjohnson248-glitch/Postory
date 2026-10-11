import { z } from "zod";

/** Shape of each entry in story_posts.media (JSONB). */
export const PostMediaSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["image", "video"]),
  storagePath: z.string().min(1),
  contentType: z.string().min(1),
  source: z.enum(["upload", "ai"]),
  altText: z.string().max(1000).optional(),
  /** LetMePost `med_…` id, cached so a retry doesn't re-upload. */
  providerMediaId: z.string().optional(),
  createdAt: z.string(),
});

export type PostMedia = z.infer<typeof PostMediaSchema>;

export function parseMedia(value: unknown): PostMedia[] {
  const parsed = z.array(PostMediaSchema).safeParse(value);
  return parsed.success ? parsed.data : [];
}

export const MEDIA_BUCKET = "post-media";
export const ALLOWED_MEDIA_TYPES: Record<string, "image" | "video"> = {
  "image/png": "image",
  "image/jpeg": "image",
  "image/webp": "image",
  "image/gif": "image",
  "video/mp4": "video",
  "video/quicktime": "video",
};
export const MAX_MEDIA_BYTES = 50 * 1024 * 1024;
