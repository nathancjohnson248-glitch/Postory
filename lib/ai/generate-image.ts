import "server-only";

import { getOpenAI, models } from "./client";
import { GenerationError } from "./generate-posts";
import { imagePrompt } from "./prompts";

export async function generateImage(input: {
  story: string;
  post: string;
  suggestion: string | null;
  businessName: string | null;
  direction?: string;
  orientation: "square" | "portrait" | "landscape";
}) {
  const openai = getOpenAI();
  const size = input.orientation === "portrait" ? "1024x1536" : input.orientation === "landscape" ? "1536x1024" : "1024x1024";
  let result;
  try {
    result = await openai.images.generate({
      model: models.image(),
      prompt: imagePrompt({ ...input, extra: input.direction }),
      size,
      n: 1,
      output_format: "png",
    });
  } catch (error) {
    throw new GenerationError("provider_error", error instanceof Error ? error.message : "Image generation failed.");
  }
  const b64 = result.data?.[0]?.b64_json;
  if (!b64) throw new GenerationError("invalid_output", "No image came back. Try again.");
  return { bytes: Buffer.from(b64, "base64"), contentType: "image/png" as const };
}
