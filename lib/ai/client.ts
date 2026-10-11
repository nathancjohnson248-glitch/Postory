import "server-only";

import OpenAI from "openai";
import { ConfigurationError, env, integrations } from "@/lib/env";

let client: OpenAI | null = null;

export function aiAvailable() {
  return integrations.openai();
}

export function getOpenAI() {
  const apiKey = env.openaiApiKey();
  if (!apiKey) throw new ConfigurationError("OPENAI_API_KEY");
  client ??= new OpenAI({ apiKey, timeout: 90_000, maxRetries: 1 });
  return client;
}

export const models = {
  text: () => env.openaiModel(),
  image: () => env.openaiImageModel(),
};
